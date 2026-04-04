# T58 — Supabase secrets, Database Webhooks & deliverability QA (no‑code)

## Goal

Wire **production** (and optionally staging) so Database Webhooks call **`send-transactional-email`**, store **secrets** safely, and complete the **deliverability gate** (Gmail, Outlook, iCloud) before you treat mail as production-ready. No application code — **Dashboard, CLI, and manual testing**.

## Dependencies

- **T55** — Resend API key exists; domain verified.
- **T57** — Edge Function deployed; function URL known.

## Scope

### 1. Supabase secrets (CLI or Dashboard)

Set at least:

| Secret | Example | Notes |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | Same value as Resend dashboard; rotate via Resend if leaked. |
| `WEBHOOK_SECRET` | Long random string | Must match the value configured on the Database Webhook HTTP **Authorization** header. |
| `FROM_EMAIL` | `no-reply@gymlogic.me` | Must be allowed by verified domain. |

```bash
# Example — use your project ref and login
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set WEBHOOK_SECRET=your-long-random-secret
supabase secrets set FROM_EMAIL=no-reply@gymlogic.me
```

Redeploy or restart Edge Functions if your workflow requires picking up new secrets.

### 2. Deploy Edge Function (if not already)

```bash
supabase functions deploy send-transactional-email --project-ref <ref>
```

Note the public URL:

`https://<project-ref>.supabase.co/functions/v1/send-transactional-email`

### 3. Database Webhook — `auth.users` INSERT

| Step | Action |
|---|---|
| 3.1 | Supabase Dashboard → **Database** → **Webhooks** (or **Integrations** → Webhooks, depending on UI version). |
| 3.2 | **Create webhook**: schema **`auth`**, table **`users`**, event **INSERT**. |
| 3.3 | **HTTP Request**: URL = Edge Function URL above. |
| 3.4 | **HTTP Headers**: add `Authorization: Bearer <WEBHOOK_SECRET>` matching `supabase secrets` (or the exact mechanism your Supabase version supports for webhook auth). |
| 3.5 | Save and ensure the webhook is **enabled**. |

**Local dev:** Webhooks in local `supabase start` often need **ngrok** or similar to reach localhost, or test against **hosted** Supabase only — document what you use.

### 4. Smoke test (manual)

| Step | Action |
|---|---|
| 4.1 | Create a **new** user (OAuth or email) on the **staging** project. |
| 4.2 | Confirm **one** welcome email in Resend dashboard and inbox. |
| 4.3 | Create the same user again (different email) — verify idempotency: **two** distinct users get **one** mail each; repeat webhook for same user should not duplicate (per **T57**). |

### 5. Deliverability QA (Epic Brief gate)

| Provider | Action |
|---|---|
| Gmail | Send welcome to a personal Gmail; check **first** message: Inbox vs Promotions vs Spam. |
| Outlook | Repeat with `@outlook.com` or `@hotmail.com`. |
| iCloud | Repeat with `@icloud.com` / `@me.com`. |

Record outcome and date (internal doc). If spam: reduce HTML weight, check SPF/DKIM alignment in “Show original”, adjust DMARC phase.

### 6. Vercel (optional checklist)

If **T59** adds `VITE_SUPPORT_EMAIL`, confirm **Preview** and **Production** envs are set for each environment.

## Out of Scope

- Code changes in repo (except redeploy triggers).
- Feedback webhooks (**T60**).
- Replacing privacy/account strings (**T59**).

## Acceptance Criteria

- [ ] `RESEND_API_KEY`, `WEBHOOK_SECRET`, and `FROM_EMAIL` are set in Supabase for the target project(s).
- [ ] Database Webhook exists for **`auth.users` INSERT** and points to **`send-transactional-email`** with correct auth header.
- [ ] A real signup produces **exactly one** welcome email per user in normal conditions.
- [ ] Deliverability spot-check completed for **Gmail, Outlook, iCloud** (first message), with results noted internally.
- [ ] No secrets pasted into GitHub issues or committed markdown.

## References

- Supabase Database Webhooks: [supabase.com/docs/guides/database/webhooks](https://supabase.com/docs/guides/database/webhooks)
- Epic Brief — Deliverability testing: `file:docs/Epic_Brief_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Tech Plan: `file:docs/Tech_Plan_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Issue: [#117](https://github.com/PierreTsia/workout-app/issues/117)
