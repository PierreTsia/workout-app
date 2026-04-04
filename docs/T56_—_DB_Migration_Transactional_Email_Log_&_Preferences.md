# T56 — DB migration: `transactional_email_log` & `user_email_preferences`

## Goal

Add Postgres tables for **idempotent transactional email** (`transactional_email_log`) and **optional feedback unsubscribe** (`user_email_preferences`), matching the Tech Plan schema, with RLS and idempotent partial unique indexes. Regenerate TypeScript database types for the app.

## Dependencies

- None (migration must sort **after** `exercise_content_feedback` — already in repo).

## Scope

### Migration SQL

Implement the sketch from `file:docs/Tech_Plan_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`:

- **`transactional_email_log`:** columns `user_id`, `email_kind`, `feedback_id` (nullable FK → `exercise_content_feedback`), `sent_at`, `provider_id`; enable RLS with **no** user policies (service role only via Edge Functions).
- **Partial unique indexes:**
  - one **welcome** per `user_id` (`WHERE email_kind = 'welcome'`);
  - one **feedback_ack** per `feedback_id` (`WHERE email_kind = 'feedback_ack'`);
  - one **feedback_resolved** per `feedback_id` (`WHERE email_kind = 'feedback_resolved'`).
- **`user_email_preferences`:** `user_id` PK, `feedback_notifications` default `true`, `updated_at`; RLS policies so users **SELECT** and **UPDATE** own row — **INSERT** policy may be needed for first-touch upsert from client or defer to **T60** (service-role upsert from unsubscribe function).

| Item | Detail |
|---|---|
| Filename | New migration under `file:supabase/migrations/` with timestamp **after** latest migration. |
| Types | Regenerate `file:src/types/database.ts` (Supabase CLI or project script). |

### Table notes

- On **`ON DELETE`** for `feedback_id`: `SET NULL` on log rows keeps history if feedback row is removed (rare); adjust if you prefer `CASCADE` delete of logs.

## Out of Scope

- Edge Function logic (**T57**, **T60**).
- Webhooks (**T58**).

## Acceptance Criteria

- [ ] Migration applies cleanly on `supabase db reset` (or `db push` to staging).
- [ ] Partial unique indexes enforce **no duplicate welcome** per user and **no duplicate ack/resolved** per feedback id.
- [ ] `transactional_email_log` is not exposed to PostgREST clients without service role (RLS default deny).
- [ ] `user_email_preferences` allows authenticated users to read/update their own row (and INSERT if required for unsubscribe flow — clarify in T60 if deferred).
- [ ] `file:src/types/database.ts` includes new tables.

## References

- Tech Plan — Data Model: `file:docs/Tech_Plan_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Issue: [#117](https://github.com/PierreTsia/workout-app/issues/117)
