# T57 — Edge Function `send-transactional-email` (welcome path)

## Goal

Implement a Supabase Edge Function that receives **Database Webhook** payloads, validates a **shared secret**, sends a **lightweight welcome email** via Resend from `no-reply@gymlogic.me`, and writes **`transactional_email_log`** for idempotency. **Scope for this ticket: `auth.users` INSERT only** — feedback branches are deferred to **T60**.

## Dependencies

- **T56** — tables exist.
- **T55** — Resend domain verified and API key available (for `supabase secrets`).

## Scope

### Function behavior

| Step | Behavior |
|---|---|
| Auth | Reject requests without `Authorization: Bearer <WEBHOOK_SECRET>` (or the header Supabase webhooks use — align with **T58**). |
| Parse | Supabase webhook JSON: `type`, `schema`, `table`, `record`, `old_record`. |
| Branch | If `schema === 'auth' && table === 'users' && type === 'INSERT'`: welcome flow. Ignore other events for this ticket (stub or 200 no-op). |
| Email | Resolve recipient from `record.email`; skip if missing. |
| Idempotency | If a **welcome** row already exists for `user_id` (or insert after send hits unique violation), return success without second send. |
| Resend | Call Resend API (`npm:resend` or `esm.sh/resend` in Deno); **minimal HTML**, no heavy images (Epic Brief). |
| Log | On success, insert `transactional_email_log` with `email_kind = 'welcome'`, `provider_id` from Resend if available. |
| Errors | 5xx on transient Resend/network errors (webhook retries); 401 on bad secret. |

### Test / CI suppression

| Env | Purpose |
|---|---|
| e.g. `SKIP_EMAIL_DOMAINS` or `SKIP_EMAIL_REGEX` | Comma-separated or pattern so test users from `file:e2e/global-setup.ts` do not call Resend in production. |

Document in `file:supabase/functions/.env.example` (non-secret keys only).

### Config

| File | Change |
|---|---|
| `file:supabase/config.toml` | `[functions.send-transactional-email] verify_jwt = false` |
| Secrets (Dashboard / CLI) | `RESEND_API_KEY`, `WEBHOOK_SECRET`, `FROM_EMAIL`, optional `FROM_NAME` |

### Files

| File | Purpose |
|---|---|
| `supabase/functions/send-transactional-email/index.ts` | Main handler. |
| Optional `supabase/functions/send-transactional-email/welcome.ts` | Subject + HTML template. |

## Out of Scope

- Dashboard webhook configuration (**T58**).
- `exercise_content_feedback` handling (**T60**).
- Unsubscribe endpoint (**T60**).
- i18n / `admin@` in UI (**T59**).

## Acceptance Criteria

- [ ] Deployed function sends a welcome email to a real test address when invoked with a valid webhook-shaped payload and secret.
- [ ] Second identical request does **not** send duplicate mail (idempotent).
- [ ] Invalid or missing webhook secret returns **401**.
- [ ] E2E / test user emails are skipped when suppression env matches (**documented**).
- [ ] `config.toml` sets `verify_jwt = false` for this function.
- [ ] No secrets in repository.

## References

- Tech Plan — Component Architecture: `file:docs/Tech_Plan_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Pattern: `file:supabase/functions/delete-account/index.ts`, `file:supabase/functions/_shared/supabase.ts`
- Issue: [#117](https://github.com/PierreTsia/workout-app/issues/117)
