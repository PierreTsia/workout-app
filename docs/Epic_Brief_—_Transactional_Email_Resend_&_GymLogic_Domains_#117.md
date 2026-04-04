# Epic Brief — Transactional Email (Resend) & GymLogic Domains #117

## Summary

Establish **gymlogic.me** as the trusted email surface for GymLogic: automated **onboarding** mail sent from **no-reply@gymlogic.me** to every new account, a consistent **admin@gymlogic.me** contact used in the product (signup, settings, help), and (nice-to-have) **feedback lifecycle** emails after submissions and when an admin marks feedback resolved. Delivery goes through **Resend** (API + domain verification), with **Supabase** (Edge Functions, secrets, and optional database webhooks/triggers) and **Vercel** environment configuration. This epic delivers reliable transactional mail without Google Workspace–style monthly cost while keeping DNS (SPF/DKIM/DMARC) under control via **Cloudflare**.

---

## Context & Problem

**Who is affected:** New users (first-touch experience), all users who read contact copy, users who submit exercise content feedback, and admins triaging feedback in `file:src/components/admin/`.

**Current state:**

- [Issue #117](https://github.com/PierreTsia/workout-app/issues/117) targets Resend + DNS + integration, but does not spell out GymLogic-specific addresses or onboarding vs feedback flows.
- Supabase Auth is configured with default email settings; `file:supabase/config.toml` shows `[auth.email]` with **no custom SMTP** enabled locally and `enable_confirmations = false` — so **auth confirmation emails are not the primary channel** for “welcome” messaging; a **dedicated send path** (Edge Function + Resend) is appropriate for onboarding content.
- The app uses **Supabase Auth** (see `file:docs/PRD.md`); new users appear in `auth.users`. Profile creation follows in `user_profiles` (`file:src/hooks/useCreateUserProfile.ts`).
- Feedback is stored in `exercise_content_feedback` with admin update policies (`file:supabase/migrations/20260315100000_exercise_content_feedback.sql`); admin triage exists per `file:docs/done/Tech_Plan_—_Admin_Feedback_Triage_View.md`.

**Pain points:**

| Pain | Impact |
|---|---|
| No branded outbound email | Users get no guided onboarding in the inbox; missed opportunity to set expectations and reduce churn. |
| No canonical support address in UI | Users and testers do not know where to reach humans; copy is inconsistent or missing. |
| Feedback is silent after submit | Users do not know the report was received; optional resolution ping improves trust. |
| Ad-hoc provider choice | Without a documented runbook, DNS and secrets drift between local, staging, and production. |

---

## Goals

| Goal | Measure |
|---|---|
| Verified sending domain | `gymlogic.me` passes Resend domain verification; SPF/DKIM/DMARC present in DNS (Cloudflare). |
| Onboarding email | ≥99% of new `auth.users` rows result in a send attempt (log + idempotency); manual spot-check in inbox. |
| Contact consistency | `admin@gymlogic.me` appears in agreed UI surfaces (i18n keys); no stray placeholder addresses. |
| Operable secrets | `RESEND_API_KEY` (and related vars) documented for Supabase Edge Functions + Vercel; not committed to git. |
| (Nice-to-have) Feedback emails | Feedback insert triggers acknowledgment email; transition to `resolved` triggers optional user email (feature-flagged or phased). |

---

## Scope

**In scope:**

1. **Resend & domain**
   - Create Resend account; add **gymlogic.me** (or subdomain strategy if chosen in Tech Plan).
   - Add DNS records in **Cloudflare** per Resend’s wizard (SPF, DKIM; DMARC policy aligned with “transactional only”).

2. **Address roles**
   - **no-reply@gymlogic.me** — From address for automated onboarding (and other system mail). Replies not monitored; say so in footer.
   - **admin@gymlogic.me** — Human-facing contact: referenced in UI strings (e.g. login/signup/help/privacy as applicable), not necessarily the SMTP “from” for bulk transactional mail.

3. **Onboarding send**
   - **Trigger:** New user created in Supabase Auth (covers OAuth and any future email/password path). Implementation options to decide in Tech Plan: **Database Webhook** on `auth.users` → Edge Function, **Auth Hook** (if available/plan-appropriate), or **Postgres trigger** + `pg_net` / queue — must guarantee **idempotency** (no duplicate welcome emails on profile updates).
   - **Content:** One generic welcome email (subject + HTML or React email template); FR/EN can be phase 2 if English-only V1 is acceptable.

4. **Supabase Edge Function**
   - New function (e.g. `send-transactional-email` or split per event) using Resend SDK; `RESEND_API_KEY` from Supabase secrets.
   - Structured logging and safe failure (do not block user signup if email fails).

5. **Vercel**
   - Document which variables the frontend needs (if any — often none for server-only send); align with deployment docs.

6. **admin@ mailbox (operational)**
   - Clarify whether **admin@** is **receive-only** via Cloudflare Email Routing → personal inbox, **Google Workspace**, or another host. Epic assumes at least **routing + display**; full mailbox vs alias is an ops decision.

**Out of scope:**

- Marketing newsletters, drip campaigns, and complex segmentation (separate epic).
- Replacing Supabase Auth’s own **confirmation/reset** templates unless product turns on `enable_confirmations` and wants custom SMTP for those — can be a follow-up once transactional pipeline is stable.
- SLA guarantees on deliverability (inbox placement) beyond standard Resend + DNS hygiene.

**Nice-to-have (phase later or same epic if bandwidth):**

- **On feedback submit:** After `INSERT` into `exercise_content_feedback`, send user a short “we received your report” email (from no-reply or a `notifications@` address if introduced later).
- **On resolve:** When admin sets status to resolved (existing admin flow), email the reporter if `user_email` is present — content must avoid leaking internal notes; optional “thank you, we’ve updated content” template.

---

## Success Criteria

- **Numeric:** In a staging or production test, a new test user receives the onboarding email within 2 minutes; Resend dashboard shows delivered (or bounced with a known fix).
- **DNS:** Third-party check (e.g. MXToolbox or `dig`) shows SPF/DKIM alignment for the chosen From domain.
- **Qualitative:** Product copy lists **admin@gymlogic.me** in the agreed screens; onboarding email matches brand tone and includes no-reply expectations.
- **Engineering:** Runbook below completed once end-to-end; secrets rotation path documented.

---

## Implementation runbook (step-by-step)

*This section is the operational spine; the Tech Plan will map it to exact function names, triggers, and code paths.*

### A. Resend

1. Sign up at [resend.com](https://resend.com).
2. Create an **API key** with sending permission; store it only in secret managers (Supabase Vault/secrets, Vercel env — never in repo).
3. **Add domain** `gymlogic.me` (or `mail.gymlogic.me` if using subdomain sending — follow one strategy consistently).

### B. Cloudflare DNS

1. Open the **gymlogic.me** zone in Cloudflare.
2. In Resend’s domain UI, copy the required **TXT/CNAME** records (SPF, DKIM).
3. Add **DMARC** (start with `p=none` for monitoring, then tighten to `quarantine`/`reject` once mail is stable).
4. If using **admin@** as a real inbox: enable **Email Routing** (or connect Workspace) so `admin@` delivers somewhere you read; this is independent of Resend sending.

### C. Supabase

1. **Secrets:** `supabase secrets set RESEND_API_KEY=re_...` (and any `FROM_EMAIL`, `ADMIN_CONTACT_EMAIL` if you parameterize).
2. **Edge Function:** Deploy function that calls Resend’s API (`POST /emails` with `from`, `to`, `subject`, `html` or template ID).
3. **Trigger onboarding:**
   - Preferred pattern to validate in Tech Plan: **Database Webhook** on `auth.users` `INSERT` → invokes Edge Function with `record` payload **or** Supabase **Auth Hook** after sign-up if on a plan that supports it.
   - Implement **deduplication** (e.g. store `user_id` + `email_type` in a small table or use Resend idempotency if offered) so retries do not double-send.
4. **RLS:** Any new table for send logs must be service-role or admin-only writes.

### D. Vercel

1. If the browser ever calls an endpoint that sends mail (discouraged), protect it with auth and rate limits; prefer **server-only** sends from Edge Functions triggered by backend events.
2. Store only non-secret **public** config in Vercel if needed (e.g. `VITE_SUPPORT_EMAIL=admin@gymlogic.me` as a build-time constant — confirm whether you want email visible in bundle or inject via runtime config).

### E. Product / UI

1. Add **admin@gymlogic.me** to `file:src/locales/en/*.json` and `file:src/locales/fr/*.json` (and any auth/onboarding components) per Tech Plan list.
2. Ensure **no-reply** is not presented as a reply target in the body copy (one line: “This inbox is not monitored…”).

### F. Nice-to-have feedback emails

1. **On insert:** DB webhook on `exercise_content_feedback` or call from existing insert path (if centralized) → Edge Function → Resend to `user_email`.
2. **On resolve:** Subscribe to `UPDATE` where `status` becomes `resolved` and `resolved_at` is set → Edge Function → email; guard against duplicate sends if status flips multiple times.

---

## Handoff notes (for Tech Plan)

- **OAuth-only sign-in:** “New user” = new row in `auth.users`; webhook must fire once per user, not on every login.
- **Idempotency:** Mandatory for welcome email; consider `email_outbox` table or Resend metadata.
- **i18n:** Onboarding V1 English-only is simplest; FR requires template duplication or locale passed from `user_profiles` / `raw_user_meta_data`.
- **Privacy:** Feedback emails must not include internal admin notes; align with `file:docs/done/Epic_Brief_—_Compliance_Legal_Privacy_and_Account_Deletion.md` if personal data is included.
- **Existing issue:** Link implementation PRs to [issue #117](https://github.com/PierreTsia/workout-app/issues/117) and update checklist items (DNS, Vercel, Supabase, test send).

---

When you are ready, say **create tech plan** to turn this into an implementation-ready Tech Plan (function names, triggers, schema for dedupe, and UI string audit).
