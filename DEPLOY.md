# Deploy & operations guide

This document captures what changed in the audit-fix sweep and the steps
required to roll those changes safely to production.

## What landed

- **Atomic Postgres RPCs** (`supabase/migrations/0001_atomic_rpcs.sql`) for
  session save/delete, payment record/update/delete, and teacher delete.
  Balance updates now happen in the same transaction as the row write, so a
  partial failure rolls back instead of corrupting state.
- **Real Supabase Auth login flow** (`components/LoginPage.tsx`,
  `lib/authContext.tsx`). The single-password gate is replaced with an
  email/password sign-in screen. There is also a Sign Out button in the nav.
- **RLS migration ready but not yet applied** (`supabase/migrations/0002_rls_authenticated_only.sql`).
  This locks all four data tables down to authenticated users only.
- **Gemini API key moved server-side** (`api/ai.ts`). The client now calls
  `/api/ai` instead of holding the key in the JS bundle.
- **Date helpers** in `lib/dateUtils.ts` to keep calendar bucketing in the
  user's local timezone — sessions near midnight no longer jump days.
- **Per-student trial overrides** correctly recalculate session price.
- **Late + Present** are now treated identically for charging and package
  depletion (was inconsistent before).
- **TypeScript strict mode** on, plus `typecheck` / `test` npm scripts.
- **Vitest test suite** covering balance deltas, trial overrides, date
  round-trips, and chargeable-status semantics. 22 tests, all passing.

## Before deploying the new code

1. **Set the missing environment variable on Vercel** (Project Settings → Environment Variables):
   - `GEMINI_API_KEY` — required for the `/api/ai` proxy. Use the same key the
     old front-end was using.
   - Existing `SUPABASE_URL` and `SUPABASE_ANON_KEY` continue to work; the
     `VITE_*`-prefixed names are also accepted.
   - Optional: `VITE_SITE_PASSWORD` and `VITE_ADMIN_PASSWORD` if you want the
     existing password gates to keep working in dev.

2. **Create your first Supabase Auth user** (Supabase Dashboard → Authentication
   → Users → "Add user"). This is the email/password you'll log in with.

3. **Deploy** to Vercel. The login page will replace the password gate. Sign in
   with the user you just created.

## Locking down RLS (after step 2 above is done)

Once you can sign in and the app works, apply the second migration to remove
anonymous access from the data tables:

```sql
-- supabase/migrations/0002_rls_authenticated_only.sql
```

Run it via the Supabase SQL editor (Dashboard → SQL → "New query") or with the
Supabase MCP `apply_migration`. After this, the anon key alone cannot read or
write the data — sign-in is required.

## What was NOT done

These items were outside the audit scope or genuinely require product decisions:

- Multi-tenant user_id-scoped RLS (the policies are single-tenant).
- Replacing the client-side admin password gate with a role-based check inside
  Auth (the gate still lives as a UI lock; data is already RLS-protected once
  0002 is applied).
- Realtime Supabase subscriptions for cross-tab consistency.
- Refactoring `App.tsx` / `StudentDetail.tsx` into smaller domain hooks. The
  `studentsRef` workaround is still there; switching to `useReducer` is a
  larger restructure that's safe to defer.

## Recovery from a failed mutation

The atomic RPCs make this much less likely, but if you ever see a stale balance:

```sql
-- Recompute one student's balance from scratch
with charges as (
  select s.student_ids,
         coalesce(public._chargeable_delta(to_jsonb(s), sid), 0) as delta,
         sid
  from public.sessions s,
       jsonb_array_elements_text(to_jsonb(s)->'student_ids') as sid
  where sid = 'STUDENT_ID_HERE'
),
totals as (
  select
    (select coalesce(sum(delta), 0) from charges) as total_charges,
    (select coalesce(sum(amount), 0) from public.payments where student_id = 'STUDENT_ID_HERE') as total_paid
)
select total_charges - total_paid as expected_balance from totals;
```
