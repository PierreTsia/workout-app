# T121 — Privacy Policy + In-App Disclosure for Embedded Agent

## Goal

Ship the GA blocker for Phase B (Story **#22**). Update the Privacy Policy to describe **Embedded Agent** chat data (what's collected, where it goes, **90-day** message retention, immediate deletion on account erasure) in **EN** and **FR**, and add an **inline non-blocking disclosure card** above the chat in `EmbeddedAgentChatStep` linking to the Privacy Policy. **Without this ticket merged the flag must stay default-off in production.**

Addresses Epic Brief stories: **#17**, **#22**.

## Mode

**HITL** — wording requires human (legal / maintainer) review. UI plumbing is mechanical; the language is not.

## Slice

`Privacy Policy MDX/i18n strings → inline disclosure Card in EmbeddedAgentChatStep → vitest`

## Dependencies

`T117` (chat shell exists; this ticket injects the disclosure card into it).

## Scope

### Privacy Policy update — `file:src/pages/PrivacyPage.tsx` + `src/locales/{en,fr}/privacy.json`

- New section: **AI onboarding chat (Embedded Agent)**. Cover:
  - **What is collected**: free-text chat content during onboarding (potentially health-adjacent — injuries, fuzzy goals).
  - **Where it goes**: stored in our database (Supabase Postgres) under RLS; sent to our LLM provider for inference at request time; provider does **not** retain content beyond the request (cite the provider's data retention rule once the maintainer confirms it during this ticket).
  - **Retention**: raw chat content kept while the onboarding attempt is active; after **commit** or **abandon**, raw text is **purged after 90 days**. Aggregate metadata (status, program link, timestamps, summary) persists.
  - **Deletion**: deleting your account immediately removes all Embedded Agent rows.
  - **No tracking / no marketing reuse** of chat content.
- Both EN and FR strings must ship together (no half-localized release).

### In-app disclosure — extend `file:src/components/onboarding/EmbeddedAgentChatStep.tsx`

- Above the chat compose area (or directly under the title), render a shadcn `<Card>` (or `<Alert>` variant `info`) with:
  - Short paragraph: "We use your answers to draft a program. Chat content is stored on our servers and processed by our AI provider; we keep raw text up to 90 days. [Read the Privacy Policy](/privacy)."
  - Internal link to `/privacy` (no new tab — same SPA).
  - Variant: **inline, non-blocking** (per refinement decision). No "I accept" button. The link is sufficient disclosure for v1.
- Card visible on every onboarding session (no dismiss state in v1) — keeps the disclosure surface deterministic. A "remember dismissal" mechanism is a follow-up if user feedback flags it.

### Tests

- **RTL** — `PrivacyPage.test.tsx` extend: new section heading rendered for EN and FR.
- **RTL** — `EmbeddedAgentChatStep.test.tsx` extend: disclosure card present; link points to `/privacy`; both locales render.
- **Lint / link check**: ensure `/privacy` route resolves; if not, add it (it already exists per `file:src/router/index.tsx`).

## Out of Scope

- No legal opinion gate — wording lands AS reviewed by the maintainer; future revisions can ship as separate doc tickets.
- No first-run modal (per refinement decision: inline-only).
- No analytics tracking on disclosure visibility — irrelevant for v1.
- No cookie banner / GDPR consent page; this is an in-product disclosure, not consent management.

## Acceptance Criteria

- [ ] Privacy Policy contains a new "AI onboarding chat" section in EN and FR covering what / where / retention / deletion.
- [ ] `EmbeddedAgentChatStep` shows an inline non-blocking disclosure card above the chat, linking to `/privacy`.
- [ ] Card and Privacy Policy strings reviewed by the maintainer (HITL gate).
- [ ] EN and FR ship together; tests render both locales.
- [ ] No regression on the existing Privacy Policy or onboarding wizard.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md` — Privacy & GDPR (ship blocker)
- Glossary: `file:docs/CONTEXT.md` — `Embedded Agent thread retention`, `Embedded Agent onboarding product (v1)`
- Privacy page today: `file:src/pages/PrivacyPage.tsx`, `file:src/locales/en/privacy.json`, `file:src/locales/fr/privacy.json`
