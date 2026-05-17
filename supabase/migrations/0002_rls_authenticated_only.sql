-- 0002 — Lock down table access to authenticated users.
--
-- APPLY THIS ONLY AFTER:
--   1. You have created at least one Supabase Auth user (Dashboard → Authentication → Users).
--   2. You have deployed the front-end code that ships the LoginPage and AuthProvider.
--
-- Once applied, the anon key can no longer read or write the data tables.
-- The RPCs in 0001 already require authenticated roles via these policies.

alter table public.students  enable row level security;
alter table public.sessions  enable row level security;
alter table public.payments  enable row level security;
alter table public.teachers  enable row level security;

-- Drop ANY pre-existing permissive policy. Names from the original schema:
drop policy if exists "anon read students"     on public.students;
drop policy if exists "anon read sessions"     on public.sessions;
drop policy if exists "anon read payments"     on public.payments;
drop policy if exists "anon read teachers"     on public.teachers;
drop policy if exists "public read students"   on public.students;
drop policy if exists "public write students"  on public.students;
drop policy if exists "public read sessions"   on public.sessions;
drop policy if exists "public write sessions"  on public.sessions;
drop policy if exists "public read payments"   on public.payments;
drop policy if exists "public write payments"  on public.payments;
drop policy if exists "public read teachers"   on public.teachers;
drop policy if exists "public write teachers"  on public.teachers;
drop policy if exists "authenticated full students" on public.students;
drop policy if exists "authenticated full sessions" on public.sessions;
drop policy if exists "authenticated full payments" on public.payments;
drop policy if exists "authenticated full teachers" on public.teachers;

-- Single-tenant app: any authenticated user has full access. (Swap these for
-- user_id-scoped policies if/when this becomes multi-tenant.)
create policy "authenticated full students" on public.students
  for all to authenticated using (true) with check (true);
create policy "authenticated full sessions" on public.sessions
  for all to authenticated using (true) with check (true);
create policy "authenticated full payments" on public.payments
  for all to authenticated using (true) with check (true);
create policy "authenticated full teachers" on public.teachers
  for all to authenticated using (true) with check (true);
