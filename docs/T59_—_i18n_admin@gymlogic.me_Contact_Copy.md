# T59 — i18n: `admin@gymlogic.me` contact copy

## Goal

Replace ad-hoc personal emails in user-facing copy with the canonical support address **`admin@gymlogic.me`** (FR + EN), and optionally centralize via **`VITE_SUPPORT_EMAIL`** so the value is not duplicated across JSON files.

## Dependencies

- None (can ship in parallel with **T57**). Prefer merging before public launch so privacy policy matches real operations (**T55** mailbox or routing should exist).

## Scope

### Files to audit and update

| Area | Files (minimum) |
|---|---|
| Privacy | `file:src/locales/en/privacy.json`, `file:src/locales/fr/privacy.json` — today reference a personal Gmail; replace with `admin@gymlogic.me`. |
| Account | `file:src/locales/en/account.json`, `file:src/locales/fr/account.json` — “contact support” strings. |
| Optional | `file:src/locales/en/auth.json` / `fr` — short “Questions? Email …” under login if product wants it. |

### Optional env-driven constant

| Approach | Detail |
|---|---|
| A | Hard-code `admin@gymlogic.me` in locale strings only. |
| B | Single `VITE_SUPPORT_EMAIL` in Vercel; build one small helper or i18n interpolation from env (avoid breaking FR build if unset — default to `admin@gymlogic.me`). |

Pick one; **B** reduces drift if the address ever changes.

### Out of Scope

- Legal review of full privacy text (content owner’s responsibility).
- Changing **no-reply** footer inside email templates (**T57**).

## Acceptance Criteria

- [ ] No user-facing locale string points to the old personal Gmail for **support/privacy contact** (grep the old address to confirm removal).
- [ ] EN and FR **privacy** contact sections reference **admin@gymlogic.me** (or env-driven equivalent).
- [ ] Account error / support hints reference the same address.
- [ ] If `VITE_SUPPORT_EMAIL` is used, **Vercel** env is documented in README or deploy doc snippet.

## References

- Tech Plan — Frontend: `file:docs/Tech_Plan_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Epic Brief: `file:docs/Epic_Brief_—_Transactional_Email_Resend_&_GymLogic_Domains_#117.md`
- Issue: [#117](https://github.com/PierreTsia/workout-app/issues/117)
