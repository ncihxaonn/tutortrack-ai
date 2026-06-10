-- 0003 — Security hardening for the RPC surface (applied 2026-06-11).
--
-- 1. Pins search_path on every function (Supabase advisor 0011: a mutable
--    search_path on a PUBLIC-executable function is an injection vector). All
--    function bodies are already schema-qualified, so '' is safe.
-- 2. Revokes the write RPCs from anon/public — only authenticated users (post
--    Supabase Auth login) should be able to mutate balances/sessions/payments.
--    This is defense-in-depth on top of the 0002 RLS lockdown.

alter function public._price_per_student(jsonb, text) set search_path = '';
alter function public._chargeable_delta(jsonb, text)  set search_path = '';
alter function public.save_session(jsonb)             set search_path = '';
alter function public.delete_session(text)            set search_path = '';
alter function public.record_payment(jsonb)           set search_path = '';
alter function public.update_payment(jsonb)           set search_path = '';
alter function public.delete_payment(text)            set search_path = '';
alter function public.delete_teacher(text)            set search_path = '';

revoke execute on function public.save_session(jsonb)   from public, anon;
revoke execute on function public.delete_session(text)  from public, anon;
revoke execute on function public.record_payment(jsonb) from public, anon;
revoke execute on function public.update_payment(jsonb) from public, anon;
revoke execute on function public.delete_payment(text)  from public, anon;
revoke execute on function public.delete_teacher(text)  from public, anon;
revoke execute on function public._price_per_student(jsonb, text) from public, anon;
revoke execute on function public._chargeable_delta(jsonb, text)  from public, anon;
