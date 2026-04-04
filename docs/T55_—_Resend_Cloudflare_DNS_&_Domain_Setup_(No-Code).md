# T55 — Resend, Cloudflare DNS & domain setup (no‑code)

## Goal

Complete all **account- and DNS-level** work so **gymlogic.me** can send mail through Resend with correct SPF/DKIM/DMARC, and **admin@gymlogic.me** can receive or forward mail for human support. This ticket is **documentation and dashboard operations only** — no application code. It unblocks API keys and DNS verification for later tickets.

## Dependencies

- None (start here in parallel with DB work if you prefer).

## Scope

### 1. Resend account and API keys

| Step | Action |
|---|---|
| 1.1 | Sign up at [resend.com](https://resend.com). |
| 1.2 | Open **API Keys** → create a key with a clear name (e.g. `gymlogic-production`). Store it in a password manager — **never commit** it. |
| 1.3 | (Recommended) Create a second key for staging / local experiments (`gymlogic-staging`) so you can rotate or revoke without touching prod. |

### 2. Add sending domain in Resend

| Step | Action |
|---|---|
| 2.1 | In Resend → **Domains** → **Add domain**. Enter `gymlogic.me` (or a subdomain such as `mail.gymlogic.me` if you choose subdomain sending — stay consistent with `file:docs/Tech_Plan_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`). |
| 2.2 | Resend shows **DNS records** to add (typically SPF as TXT, DKIM as CNAMEs). Keep this page open for Cloudflare. |
| 2.3 | Wait until Resend shows **Verified** for the domain before relying on production sends. |

### 3. Cloudflare DNS (gymlogic.me zone)

| Step | Action |
|---|---|
| 3.1 | Log in to Cloudflare → select the **gymlogic.me** zone → **DNS** → **Records**. |
| 3.2 | Add each record **exactly** as Resend specifies (name, type, value, TTL — often “Auto”). |
| 3.3 | Avoid duplicate SPF TXT records: there should be **one** SPF policy per aligned domain; merge includes if you use multiple senders later. |
| 3.4 | After propagation (minutes to hours), return to Resend and click **Verify** until the domain is green. |

### 4. DMARC (recommended)

| Step | Action |
|---|---|
| 4.1 | Add a **TXT** record at `_dmarc.gymlogic.me` (or the subdomain you send from). |
| 4.2 | Start with monitoring only, e.g. `v=DMARC1; p=none; rua=mailto:dmarc@gymlogic.me` (use a mailbox you read, or a dedicated reporting address). |
| 4.3 | After welcome mail is stable and metrics look good, tighten policy (`p=quarantine` then `p=reject`) per Epic Brief — **not** on day one. |

### 5. `admin@gymlogic.me` (receive path)

**Sending** from `no-reply@` is done via Resend. **Receiving** at `admin@` is separate:

| Option | Action |
|---|---|
| A — Cloudflare Email Routing | In Cloudflare → **Email** → **Email Routing**: enable routing, create address **admin@gymlogic.me** → destination your personal inbox. |
| B — Google Workspace / other host | Add MX records per provider; may replace Cloudflare routing for that domain. |

Document which option you chose in your internal runbook (not necessarily in this repo).

### 6. “From” addresses in Resend

| Address | Role |
|---|---|
| `no-reply@gymlogic.me` | Automated onboarding / system mail (must be on verified domain). |
| `admin@gymlogic.me` | Human-facing **contact in UI**; may or may not be used as SMTP “From” for rare manual sends. |

Confirm in Resend that you can send from `no-reply@gymlogic.me` (domain verified = usually yes for any address on that domain).

### 7. Vercel (frontend public config — prepare only)

No code in this ticket; **record** what you will set when implementing **T59**:

| Variable | Example | Purpose |
|---|---|---|
| `VITE_SUPPORT_EMAIL` | `admin@gymlogic.me` | Optional single source for support copy in the app (if you adopt this pattern). |

Add these in the Vercel project → **Settings** → **Environment Variables** when T59 merges.

## Out of Scope

- Supabase secrets and Edge Function deployment (**T57**, **T58**).
- Database Webhooks configuration (**T58**).
- Changing locale JSON files (**T59**).

## Acceptance Criteria

- [ ] Resend domain for `gymlogic.me` (or chosen subdomain) shows **Verified** with SPF/DKIM passing in Resend’s UI.
- [ ] Cloudflare DNS contains the Resend-provided records and **DMARC** TXT at `_dmarc` (or documented reason to defer DMARC).
- [ ] At least one **API key** exists in Resend and is stored only in a secret manager (not in git).
- [ ] **admin@gymlogic.me** either receives mail (routing) or a conscious decision is documented to use only a public contact string without a mailbox yet.
- [ ] Internal note lists **where** prod and staging API keys live (1Password, Vault, etc.).

## References

- Epic Brief: `file:docs/Epic_Brief_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Tech Plan: `file:docs/Tech_Plan_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Issue: [#117](https://github.com/PierreTsia/workout-app/issues/117)
