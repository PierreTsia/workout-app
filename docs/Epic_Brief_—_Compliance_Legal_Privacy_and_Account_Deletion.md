# Epic Brief — Compliance, Legal, Privacy & Account Deletion

## Summary

This epic ships the **minimum credible compliance layer** for taking the app past “trusted prototype”: a **public Privacy Policy** at `/privacy` that describes real data practices (Supabase, Google sign-in, device storage, optional analytics-style events), **obvious discovery** of that policy from both **logged-out** and **logged-in** surfaces, and an **account deletion** path that matches what the policy promises—**deliberate confirmation**, then **technical deletion** of the user’s account and associated rows where the database already cascades, with any **exceptions** (e.g. anonymized retention) stated honestly in the policy. It tracks [GitHub #110](https://github.com/PierreTsia/workout-app/issues/110) and supports [Go Live checklist #44](https://github.com/PierreTsia/workout-app/issues/44) §2. **This document is product and engineering guidance, not legal advice;** a short lawyer review is still wise before high-stakes launches (health claims, minors, B2B).

---

## Context & Problem

**Who is affected:** Everyone who can use the app: **anonymous visitors** (marketing/about flows), **authenticated users** (Google OAuth via Supabase), and **you** as operator (accuracy of disclosures, support burden if copy overpromises).

**Current state:**

- **No dedicated privacy route.** [`file:src/router/index.tsx`](file:src/router/index.tsx) exposes `/login` and `/about` outside the authenticated shell; there is **no** `/privacy`. [`file:src/pages/AboutPage.tsx`](file:src/pages/AboutPage.tsx) mentions privacy in **marketing** copy (`featurePrivacy` in i18n) but does not substitute for a structured policy.
- **No in-app link to a policy** in [`file:src/components/SideDrawer.tsx`](file:src/components/SideDrawer.tsx) (settings surface: theme, locale, weight unit, About, install, sign-out)—users cannot find legal text without leaving the product.
- **No self-service account deletion** in the UI. Sign-out exists; **deleting the Supabase auth user** and relying on **FK cascades** is not exposed. Schema already ties most user-owned rows to `auth.users` with `ON DELETE CASCADE` (e.g. [`file:supabase/migrations/20240101000002_create_workout_days.sql`](supabase/migrations/20240101000002_create_workout_days.sql), [`file:supabase/migrations/20240101000004_create_sessions.sql`](supabase/migrations/20240101000004_create_sessions.sql), [`file:supabase/migrations/20260314000002_create_programs.sql`](supabase/migrations/20260314000002_create_programs.sql)); [`file:supabase/migrations/20260314000007_create_analytics_events.sql`](supabase/migrations/20260314000007_create_analytics_events.sql) uses **`ON DELETE SET NULL`** on `user_id`, so events may **outlive** the account in a **pseudonymous** form— the policy must **either** promise anonymization consistent with that behavior **or** the Tech Plan must add cleanup.
- **PRD** ([`file:docs/PRD.md`](docs/PRD.md)) documents stack (Supabase, RLS, PWA, optional feedback/AI features)—the policy must stay **aligned** with what actually ships (no phantom “we sell your data” clauses unless true).

**Pain points:**

| Pain | Impact |
|---|---|
| Marketing says “privacy-minded” without a policy | Trust gap; store / regulator friction if you scale EU users |
| No deletion UX | GDPR-style **right to erasure** expectations; users email you manually |
| Policy/code drift | Legal exposure and user anger if the app does X but the text says Y |
| Analytics / feedback rows without clear story | Odd retention after “delete my account” undermines the whole flow |

---

## Goals

| Goal | Measure |
|---|---|
| Honest disclosure | Policy sections cover **identity of operator**, **what is collected**, **why**, **where it is processed** (Supabase region / sub-processors at high level), **retention** (what we know today), **rights** (access, correction, deletion, objection where applicable), and **contact** for privacy requests |
| Discoverability | `/privacy` is linked from **SideDrawer** (settings) and from **Login** (and optionally **About**) so a reasonable user finds it in **≤2 taps** from each major entry surface |
| Account deletion | Authenticated user can **request deletion** from Settings; **confirmation step** prevents accidents; completion signs them out and **removes auth user**; app behavior matches policy on **cascaded data** and any **retained/anonymized** rows |
| i18n parity | **EN + FR** for policy shell (title, nav, “last updated”) and for UI chrome around deletion; policy body may start **one locale** full + other stub if time-boxed—Tech Plan decides, but **not** silent FR-only users |
| Operator sanity | Single **“data practices”** source of truth: policy claims are **checkable** against schema and [`file:docs/PRD.md`](docs/PRD.md) |

---

## Scope

**In scope:**

1. **Route & page** — Add `/privacy` as a **public** route (same auth level as `/about`), implemented as e.g. `PrivacyPolicy.tsx` + **structured sections** (not a wall of lorem). Styling may reuse About-like layout or App shell—**Tech Plan** picks consistency vs. standalone legal page.
2. **Policy content (substance)** — Plain-language sections aligned with **actual** behavior: Google OAuth; workout data in Postgres; RLS; **local/device** storage (sync queue, preferences, PWA cache—high level); **notifications** prompt; **exercise content feedback** and **AI generation** logging if user-identifying; **analytics_events** behavior on account deletion (**SET NULL** → explain as anonymized or change behavior in Tech Plan).
3. **Discovery** — Link in [`file:src/components/SideDrawer.tsx`](file:src/components/SideDrawer.tsx) near About / account area; link on [`file:src/pages/LoginPage.tsx`](file:src/pages/LoginPage.tsx) (footer or secondary text); optional link from [`file:src/pages/AboutPage.tsx`](file:src/pages/AboutPage.tsx).
4. **Account deletion UX** — New **Settings** subsection (same drawer or dedicated sheet): explain consequences, **type-to-confirm** or **two-step** dialog (match severity of irreversibility), then call **server-side** deletion using **service role only on the backend** (e.g. Supabase Edge Function with JWT verification)—**never** expose service role in the client ([`file:docs/PRD.md`](docs/PRD.md) already warns on `SERVICE_ROLE_KEY`).
5. **Post-deletion client behavior** — Clear success state, sign-out, redirect; handle **pending offline queue** (warn or flush policy—Tech Plan).

**Out of scope:**

- **Terms of Service** / **Cookie banner** as a full separate epic (unless merged later into same page)—this epic is **Privacy + deletion** only.
- **DPA** with Supabase or **SCCs** paperwork—operator task outside the repo.
- **Legal review** by a licensed attorney—recommended but not a code deliverable.
- **Changing** analytics schema beyond what deletion requires—optional follow-up if policy promises full purge of events.
- **Admin** impersonation, export-my-data ZIP, or **regional** age gates—defer unless #44 or a new issue expands scope.

---

## Success Criteria

- **Numeric:** **100%** of bullet claims in the shipped Privacy Policy that describe **technical** behavior (storage location, auth method, deletion effect on workout data) are **verifiable** against migrations and runtime (spot-check checklist in Tech Plan).
- **Numeric:** From **Login** and from **home with drawer open**, user reaches `/privacy` in **≤2** navigational actions (tap/link, not counting scroll).
- **Qualitative:** A user can **delete their account** without emailing support; after deletion they **cannot** sign back in as the same identity and **do not** see prior programs/sessions when creating a **new** account.
- **Qualitative:** Wording avoids **false certainty** (“we never share data”) unless true; **sub-processors** (e.g. Supabase, Vercel, Google) are named at a **proportionate** level for an indie PWA.
- **Qualitative:** If **`analytics_events`** or similar rows remain after deletion, the policy **explicitly** says so in everyday language—no “we erase everything” unless implementation matches.

---

When you're ready, say **create tech plan** to continue.
