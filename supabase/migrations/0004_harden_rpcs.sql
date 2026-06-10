-- 0004 — Concurrency, integrity, and validation hardening for the write RPCs.
--
-- Fixes:
--  * Race conditions: read-then-mutate without locking let two concurrent calls
--    (two tabs, double-click, retry) double-reverse charges / double-refund
--    payments. save_session/delete_session now take a transaction-scoped advisory
--    lock on the session id (covers the not-yet-inserted race that FOR UPDATE
--    can't), and update_payment/delete_payment lock or delete-returning the row
--    so balance changes only apply when this transaction owns the row.
--  * Silent orphans: record_payment/update_payment now raise (and roll back) when
--    the target student doesn't exist, instead of committing a payment whose
--    balance change matched zero rows.
--  * update_payment now returns BOTH affected students (old + new) so moving a
--    payment between students refreshes both balances in the UI.
--  * Missing date keys no longer silently write NULL timestamps.
--
-- Each function is re-declared with `set search_path = ''` (see 0003) and a fully
-- schema-qualified body.

create or replace function public.save_session(p_session jsonb)
returns jsonb language plpgsql
set search_path = ''
as $$
declare
  v_id text := p_session->>'id';
  v_old record;
  affected_ids text[] := array[]::text[];
  sid text;
  delta numeric;
  saved_session record;
  out_students jsonb;
  out_session jsonb;
begin
  if v_id is null then raise exception 'session id is required'; end if;
  if p_session->>'date' is null then raise exception 'session date is required'; end if;

  perform pg_advisory_xact_lock(hashtext('session:' || v_id));

  select * into v_old from public.sessions where id = v_id for update;
  if found then
    for sid in select jsonb_array_elements_text(coalesce(to_jsonb(v_old)->'student_ids', '[]'::jsonb)) loop
      delta := public._chargeable_delta(to_jsonb(v_old), sid);
      if delta <> 0 then
        update public.students set balance = balance - delta where id = sid;
        affected_ids := array_append(affected_ids, sid);
      end if;
    end loop;
  end if;

  insert into public.sessions (id, student_ids, date, duration_minutes, status, student_statuses, type, topic, notes, price, is_trial, teacher_id)
  values (
    v_id,
    array(select jsonb_array_elements_text(coalesce(p_session->'student_ids', '[]'::jsonb))),
    (p_session->>'date')::timestamptz,
    coalesce((p_session->>'duration_minutes')::int, 60),
    p_session->>'status',
    coalesce(p_session->'student_statuses', '[]'::jsonb),
    p_session->>'type',
    coalesce(p_session->>'topic', ''),
    coalesce(p_session->>'notes', ''),
    coalesce((p_session->>'price')::numeric, 0),
    coalesce((p_session->>'is_trial')::boolean, false),
    nullif(p_session->>'teacher_id', '')::text
  )
  on conflict (id) do update set
    student_ids = excluded.student_ids,
    date = excluded.date,
    duration_minutes = excluded.duration_minutes,
    status = excluded.status,
    student_statuses = excluded.student_statuses,
    type = excluded.type,
    topic = excluded.topic,
    notes = excluded.notes,
    price = excluded.price,
    is_trial = excluded.is_trial,
    teacher_id = excluded.teacher_id
  returning * into saved_session;

  for sid in select jsonb_array_elements_text(coalesce(p_session->'student_ids', '[]'::jsonb)) loop
    delta := public._chargeable_delta(p_session, sid);
    if delta <> 0 then
      update public.students set balance = balance + delta where id = sid;
      affected_ids := array_append(affected_ids, sid);
    end if;
  end loop;

  select to_jsonb(saved_session) into out_session;
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    into out_students from public.students s where s.id = any(affected_ids);

  return jsonb_build_object('session', out_session, 'students', out_students);
end;
$$;

create or replace function public.delete_session(p_session_id text)
returns jsonb language plpgsql
set search_path = ''
as $$
declare
  v_old record;
  affected_ids text[] := array[]::text[];
  sid text;
  delta numeric;
  out_students jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('session:' || p_session_id));

  delete from public.sessions where id = p_session_id returning * into v_old;
  if not found then
    return jsonb_build_object('students', '[]'::jsonb);
  end if;

  for sid in select jsonb_array_elements_text(coalesce(to_jsonb(v_old)->'student_ids', '[]'::jsonb)) loop
    delta := public._chargeable_delta(to_jsonb(v_old), sid);
    if delta <> 0 then
      update public.students set balance = balance - delta where id = sid;
      affected_ids := array_append(affected_ids, sid);
    end if;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    into out_students from public.students s where s.id = any(affected_ids);

  return jsonb_build_object('students', out_students);
end;
$$;

create or replace function public.record_payment(p_payment jsonb)
returns jsonb language plpgsql
set search_path = ''
as $$
declare
  v_id text := p_payment->>'id';
  v_student_id text := p_payment->>'student_id';
  v_amount numeric := coalesce((p_payment->>'amount')::numeric, 0);
  saved_row record;
  out_student record;
begin
  if p_payment->>'date' is null then raise exception 'payment date is required'; end if;

  insert into public.payments (id, student_id, amount, date, method, class_count, class_type)
  values (
    v_id, v_student_id, v_amount,
    (p_payment->>'date')::timestamptz,
    coalesce(p_payment->>'method', 'Manual'),
    nullif(p_payment->>'class_count', 'null')::int,
    nullif(p_payment->>'class_type', 'null')
  )
  returning * into saved_row;

  update public.students set balance = balance - v_amount where id = v_student_id
    returning * into out_student;
  if out_student is null then raise exception 'Student % not found', v_student_id; end if;

  return jsonb_build_object('payment', to_jsonb(saved_row), 'student', to_jsonb(out_student));
end;
$$;

create or replace function public.update_payment(p_payment jsonb)
returns jsonb language plpgsql
set search_path = ''
as $$
declare
  v_id text := p_payment->>'id';
  v_new_amount numeric := coalesce((p_payment->>'amount')::numeric, 0);
  v_new_student text := p_payment->>'student_id';
  v_old record;
  saved_row record;
  out_students jsonb;
begin
  if p_payment->>'date' is null then raise exception 'payment date is required'; end if;

  select * into v_old from public.payments where id = v_id for update;
  if not found then raise exception 'Payment % not found', v_id; end if;

  update public.students set balance = balance + v_old.amount where id = v_old.student_id;

  update public.payments set
    student_id = v_new_student,
    amount = v_new_amount,
    date = (p_payment->>'date')::timestamptz,
    method = coalesce(p_payment->>'method', 'Manual'),
    class_count = nullif(p_payment->>'class_count', 'null')::int,
    class_type = nullif(p_payment->>'class_type', 'null')
  where id = v_id
  returning * into saved_row;

  update public.students set balance = balance - v_new_amount where id = v_new_student;
  if not found then raise exception 'Student % not found', v_new_student; end if;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    into out_students from public.students s where s.id in (v_old.student_id, v_new_student);

  return jsonb_build_object('payment', to_jsonb(saved_row), 'students', out_students);
end;
$$;

create or replace function public.delete_payment(p_payment_id text)
returns jsonb language plpgsql
set search_path = ''
as $$
declare
  v_old record;
  out_student record;
begin
  delete from public.payments where id = p_payment_id returning * into v_old;
  if not found then return jsonb_build_object('student', null); end if;

  update public.students set balance = balance + v_old.amount where id = v_old.student_id
    returning * into out_student;

  return jsonb_build_object('student', to_jsonb(out_student));
end;
$$;
