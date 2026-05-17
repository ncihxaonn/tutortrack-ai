-- 0001 — Atomic RPCs and helpful indexes.
--
-- Replaces the multi-statement client writes (session+balance, payment+balance)
-- with single-transaction Postgres functions so a partial failure rolls back
-- instead of corrupting balances. RLS is locked down in the follow-up 0002
-- migration once at least one Supabase Auth user exists.
--
-- All RPCs are SECURITY INVOKER so RLS still applies to the caller.

-- ── Helpers ────────────────────────────────────────────────────────────────
-- Per-student price for a session, honoring per-student trial overrides.
-- Trial students pay 0; non-trial students split the session price evenly.
create or replace function public._price_per_student(p_session jsonb, p_student_id text)
returns numeric language plpgsql immutable as $$
declare
  non_trial_count int := 0;
  is_trial_here boolean;
  override boolean;
  session_is_trial boolean := coalesce((p_session->>'is_trial')::boolean, false);
  status_obj jsonb;
  sid text;
begin
  for status_obj in select * from jsonb_array_elements(coalesce(p_session->'student_statuses', '[]'::jsonb)) loop
    if (status_obj->>'studentId') = p_student_id and status_obj ? 'isTrial' then
      override := (status_obj->>'isTrial')::boolean;
    end if;
  end loop;

  is_trial_here := coalesce(override, session_is_trial);
  if is_trial_here then
    return 0;
  end if;

  for sid in select jsonb_array_elements_text(coalesce(p_session->'student_ids', '[]'::jsonb)) loop
    declare
      sid_override boolean := null;
    begin
      for status_obj in select * from jsonb_array_elements(coalesce(p_session->'student_statuses', '[]'::jsonb)) loop
        if (status_obj->>'studentId') = sid and status_obj ? 'isTrial' then
          sid_override := (status_obj->>'isTrial')::boolean;
        end if;
      end loop;
      if not coalesce(sid_override, session_is_trial) then
        non_trial_count := non_trial_count + 1;
      end if;
    end;
  end loop;

  if non_trial_count = 0 then
    return 0;
  end if;
  return coalesce((p_session->>'price')::numeric, 0) / non_trial_count;
end;
$$;

-- Chargeable delta for a single student given a session payload.
-- Late and Present both charge; Absent and Cancelled do not.
create or replace function public._chargeable_delta(p_session jsonb, p_student_id text)
returns numeric language plpgsql immutable as $$
declare
  status text;
  status_obj jsonb;
  session_status text := coalesce(p_session->>'status', 'Present');
  found boolean := false;
begin
  for status_obj in select * from jsonb_array_elements(coalesce(p_session->'student_statuses', '[]'::jsonb)) loop
    if (status_obj->>'studentId') = p_student_id then
      status := status_obj->>'status';
      found := true;
    end if;
  end loop;
  if not found then
    status := session_status;
  end if;
  if status in ('Present', 'Late') then
    return public._price_per_student(p_session, p_student_id);
  end if;
  return 0;
end;
$$;

-- ── save_session ────────────────────────────────────────────────────────────
create or replace function public.save_session(p_session jsonb)
returns jsonb language plpgsql as $$
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
  select * into v_old from public.sessions where id = v_id;
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
    into out_students
    from public.students s
    where s.id = any(affected_ids);

  return jsonb_build_object('session', out_session, 'students', out_students);
end;
$$;

-- ── delete_session ──────────────────────────────────────────────────────────
create or replace function public.delete_session(p_session_id text)
returns jsonb language plpgsql as $$
declare
  v_old record;
  affected_ids text[] := array[]::text[];
  sid text;
  delta numeric;
  out_students jsonb;
begin
  select * into v_old from public.sessions where id = p_session_id;
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

  delete from public.sessions where id = p_session_id;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    into out_students
    from public.students s
    where s.id = any(affected_ids);

  return jsonb_build_object('students', out_students);
end;
$$;

-- ── record_payment / update_payment / delete_payment ────────────────────────
create or replace function public.record_payment(p_payment jsonb)
returns jsonb language plpgsql as $$
declare
  v_id text := p_payment->>'id';
  v_student_id text := p_payment->>'student_id';
  v_amount numeric := coalesce((p_payment->>'amount')::numeric, 0);
  saved_row record;
  out_student record;
begin
  insert into public.payments (id, student_id, amount, date, method, class_count, class_type)
  values (
    v_id,
    v_student_id,
    v_amount,
    (p_payment->>'date')::timestamptz,
    coalesce(p_payment->>'method', 'Manual'),
    nullif(p_payment->>'class_count', 'null')::int,
    nullif(p_payment->>'class_type', 'null')
  )
  returning * into saved_row;

  update public.students set balance = balance - v_amount where id = v_student_id
    returning * into out_student;

  return jsonb_build_object(
    'payment', to_jsonb(saved_row),
    'student', to_jsonb(out_student)
  );
end;
$$;

create or replace function public.update_payment(p_payment jsonb)
returns jsonb language plpgsql as $$
declare
  v_id text := p_payment->>'id';
  v_new_amount numeric := coalesce((p_payment->>'amount')::numeric, 0);
  v_new_student text := p_payment->>'student_id';
  v_old record;
  saved_row record;
  out_student record;
begin
  select * into v_old from public.payments where id = v_id;
  if not found then
    raise exception 'Payment % not found', v_id;
  end if;

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

  update public.students set balance = balance - v_new_amount where id = v_new_student
    returning * into out_student;

  return jsonb_build_object(
    'payment', to_jsonb(saved_row),
    'student', to_jsonb(out_student)
  );
end;
$$;

create or replace function public.delete_payment(p_payment_id text)
returns jsonb language plpgsql as $$
declare
  v_old record;
  out_student record;
begin
  select * into v_old from public.payments where id = p_payment_id;
  if not found then
    return jsonb_build_object('student', null);
  end if;

  delete from public.payments where id = p_payment_id;
  update public.students set balance = balance + v_old.amount where id = v_old.student_id
    returning * into out_student;

  return jsonb_build_object('student', to_jsonb(out_student));
end;
$$;

-- ── delete_teacher ──────────────────────────────────────────────────────────
create or replace function public.delete_teacher(p_teacher_id text)
returns jsonb language plpgsql as $$
declare
  affected_ids text[];
  out_sessions jsonb;
begin
  select coalesce(array_agg(id), array[]::text[]) into affected_ids
    from public.sessions where teacher_id = p_teacher_id;

  update public.sessions set teacher_id = null where teacher_id = p_teacher_id;
  delete from public.teachers where id = p_teacher_id;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    into out_sessions
    from public.sessions s
    where s.id = any(affected_ids);

  return jsonb_build_object('sessions', out_sessions);
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────
-- Keep these grants compatible with both the current anon flow and the
-- post-auth flow. The follow-up RLS migration restricts table access; the
-- RPCs themselves remain callable by both roles so the grant doesn't need
-- changing.
grant execute on function public.save_session(jsonb)     to anon, authenticated;
grant execute on function public.delete_session(text)    to anon, authenticated;
grant execute on function public.record_payment(jsonb)   to anon, authenticated;
grant execute on function public.update_payment(jsonb)   to anon, authenticated;
grant execute on function public.delete_payment(text)    to anon, authenticated;
grant execute on function public.delete_teacher(text)    to anon, authenticated;

-- Helpful indexes for the query patterns the UI actually uses.
create index if not exists idx_sessions_date     on public.sessions (date);
create index if not exists idx_sessions_teacher  on public.sessions (teacher_id);
create index if not exists idx_payments_student  on public.payments (student_id);
create index if not exists idx_payments_date     on public.payments (date);
