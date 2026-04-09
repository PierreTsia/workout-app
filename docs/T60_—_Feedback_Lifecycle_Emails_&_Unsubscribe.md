# T60 — Feedback lifecycle emails & unsubscribe

## Goal

Extend **`send-transactional-email`** (or a sibling function) to handle **`exercise_content_feedback`** INSERT (acknowledgment) and UPDATE (resolved), respect **`user_email_preferences.feedback_notifications`**, and implement an **`email-unsubscribe`** Edge Function with signed tokens plus visible **Unsubscribe** + **`List-Unsubscribe`** headers on feedback mail — mandatory per Epic Brief when these emails ship.

## Dependencies

- **T56** — `transactional_email_log` (with `feedback_id`) and `user_email_preferences`.
- **T57** — Resend integration and webhook validation pattern.
- **T58** — Webhook wiring understood (same pattern for new webhooks).

## Scope

### Database Webhooks

| Event | Behavior |
|---|---|
| `INSERT` on `exercise_content_feedback` | If `user_email` present and user has not opted out, send **ack** email; log `feedback_ack` with `feedback_id` (idempotent per feedback). |
| `UPDATE` when `status` → `resolved` | If `user_email` present and preferences allow, send **resolved** mail once; log `feedback_resolved`. |

Detect true transition to resolved (compare `old_record` vs `record` in payload) to avoid duplicate sends.

### Email content

- Short, no internal admin notes; align with `file:docs/done/Epic_Brief_—_Compliance_Legal_Privacy_and_Account_Deletion.md`.
- **Unsubscribe** link near top of body; **List-Unsubscribe** header with HTTPS URL to unsubscribe endpoint.

### `email-unsubscribe` function

| Item | Detail |
|---|---|
| Route | `GET` (or `POST`) with signed token: `user_id`, `exp`, `purpose=feedback`. |
| `verify_jwt` | `false` (public link from email). |
| Action | Set `feedback_notifications = false` via service client or authenticated upsert. |

### Preferences row

- If no row in `user_email_preferences`, treat as **opted in** (Epic Brief).
- Optional: `INSERT` policy or trigger on first signup — implement if missing from **T56**.

### Config

| File | Change |
|---|---|
| `file:supabase/config.toml` | `[functions.email-unsubscribe] verify_jwt = false` |

### Webhooks (Dashboard — same secret as welcome mail)

Deploy **`send-transactional-email`** and **`email-unsubscribe`**, then add **two** database webhooks (or one webhook with **Insert** + **Update** selected — depends on UI):

| Webhook | Schema | Table | Events | URL | `Authorization` |
|---|---|---|---|---|---|
| Feedback inserts | `public` | `exercise_content_feedback` | **INSERT** | `https://<ref>.supabase.co/functions/v1/send-transactional-email` | `Bearer <WEBHOOK_SECRET>` |
| Feedback updates | `public` | `exercise_content_feedback` | **UPDATE** | same | same |

Optional env: **`UNSUBSCRIBE_SECRET`** — if unset, unsubscribe tokens use **`WEBHOOK_SECRET`** (same as webhook auth).

## Out of Scope

- Marketing newsletters.
- Changing `useSubmitFeedback` beyond optional toast copy (product choice).

## Acceptance Criteria

- [ ] New feedback insert can trigger **at most one** ack email per report (idempotent).
- [ ] Resolve transition triggers **at most one** resolution email per report.
- [ ] Users with `feedback_notifications = false` receive **no** feedback lifecycle mail.
- [ ] Unsubscribe link works without login (token verified) and persists preference.
- [ ] `List-Unsubscribe` header present on feedback-related emails.
- [ ] Webhooks for `exercise_content_feedback` configured in Dashboard (document steps like **T58**).

## References

- Epic Brief — nice-to-have + unsubscribe: `file:docs/Epic_Brief_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Tech Plan: `file:docs/Tech_Plan_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Feedback table: `file:supabase/migrations/20260315100000_exercise_content_feedback.sql`
- Issue: [#117](https://github.com/PierreTsia/workout-app/issues/117)
