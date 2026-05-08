# T117 — Edge `/thread` Route + Feature Flag + Onboarding Chat Shell

## Goal

First user-visible Phase B slice. Behind the new **`VITE_FEATURE_EMBEDDED_AGENT`** flag, the **AI path** in `OnboardingPage` mounts a new **`EmbeddedAgentChatStep`** shell that opens or resumes an **Embedded Agent thread** via a new **`/thread`** Edge route. Adds offline-only banner, explicit Restart, and abandon-on-PathChoice-back behavior.

Provides nothing chat-shaped yet — the input/turn loop comes in T118. The shell exists so that the migration + store from T116 prove themselves end-to-end with a flag-gated UI.

Addresses Epic Brief stories: **#8**, **#10**, **#11**, **#12**, **#13**, **#16**.

## Mode

**AFK** — flag style and shell scope are locked. (Migration to a remote/PostgREST flag is a deferred follow-up post-GA, not in this batch.)

## Slice

`edge embedded-agent/index.ts (/thread) → useEmbeddedAgentThread hook → OnboardingPage branch → EmbeddedAgentChatStep shell → vitest + RTL`

## Dependencies

`T116`

## Scope

### Edge Function — `file:supabase/functions/embedded-agent/index.ts`

- New router; for now exposes only `POST /thread`. Other routes (`/message`, `/draft`, `/commit`) are added by later tickets and must return 404 here.
- Auth: `supabase.auth.getUser()` (no decode-only identity), matching the Phase A proof pattern in `file:supabase/functions/mcp-phase-a-proof/index.ts`.
- Body: `{ action: "open" | "abandon", locale: "en" | "fr" }`. Server validates `locale` against the allowlist; rejects with 400 on bad input.
- `action: "open"`:
  - Run `markStale` and `purgeRetentionIfDue` (lazy maintenance).
  - Call `getOrCreateActiveThread` from T116.
  - Return `{ thread_id, status, resumed, messages: [] }` (messages stay empty until T118; we surface the field shape now to avoid client churn later).
- `action: "abandon"`:
  - Find the user's active thread; if any, `setStatus(threadId, "abandoned")`. Idempotent — no error if there's nothing to abandon.

### Feature flag

- New env var `VITE_FEATURE_EMBEDDED_AGENT` (default unset/`false`).
- Read via a tiny helper `file:src/lib/featureFlags.ts` (export `isEmbeddedAgentEnabled()`), so when we migrate to a remote flag in a follow-up there's one call site to flip.

### React Query hook — `file:src/hooks/useEmbeddedAgentThread.ts`

- `useThread(locale)` — query that calls `/thread` with `action: "open"` on mount (only when flag is on).
- `useAbandonThread()` — mutation that calls `/thread` with `action: "abandon"`.
- Invalidates a single key `['embedded-agent','thread']`.

### Component — `file:src/components/onboarding/EmbeddedAgentChatStep.tsx`

- Renders nothing model-driven yet. Shape:
  - shadcn `Card` with title (i18n key `onboarding.embeddedAgent.title`).
  - Status row: "Thread {{id_short}} · {{status}}" + "Resumed conversation" badge when `resumed`.
  - **Offline banner** (`navigator.onLine === false` or React Query failed): a `<Card>` (or `<Alert>`) with `onboarding.embeddedAgent.offline` copy. No spinner trap (Story 8).
  - **Restart** action — confirms via `<AlertDialog>`, fires `useAbandonThread()`, then triggers `useThread` again to create a fresh row.
  - **Back** action that returns to PathChoice and triggers `useAbandonThread()` on the way out (Story 11).
- Empty body says "Chat coming online…" placeholder (replaced in T118). Acceptable interim state because the flag is off in production.
- Use **shadcn primitives** per `file:.cursor/rules/prefer-shadcn-components.mdc` (Card, Button, Badge, Alert, AlertDialog).

### `file:src/pages/OnboardingPage.tsx` wiring

- New `WizardStep` value: `"embedded_chat"`.
- In the `path` step's `onAI` handler, branch on `isEmbeddedAgentEnabled()`:
  - **Flag on:** `setStep("embedded_chat")` — render `EmbeddedAgentChatStep`.
  - **Flag off:** existing `setStep("ai_generating")` path stays untouched.
- The new step's "Back to PathChoice" button calls the abandon mutation, then `setStep("path")`.
- Template/Blank paths stay flag-agnostic and never see the chat (Story 16).

### i18n

- Add namespace `onboarding.embeddedAgent` in `src/locales/{en,fr}/onboarding.json`:
  - `title`, `placeholderBody`, `offlineTitle`, `offlineBody`, `restartCta`, `restartConfirm`, `resumedBadge`, `backCta`.

### Tests

- **Deno** — `file:supabase/functions/embedded-agent/index_test.ts`:
  - 401 without bearer; 400 on bad locale; `open` returns `{ thread_id, status:'open', resumed:false }` first call, `resumed:true` second call; `abandon` is idempotent.
- **Vitest hook** — `useEmbeddedAgentThread.test.ts`: mocked fetch, asserts payload shape + cache key invalidation on abandon.
- **RTL** — `EmbeddedAgentChatStep.test.tsx`: renders status, offline banner appears when `navigator.onLine = false`, Restart triggers abandon then refetch.
- **RTL** — `OnboardingPage.test.tsx`: with flag on, AI path lands on the new step; with flag off, lands on `AIGeneratingStep` (legacy) — guard test for the cutover seam.

## Out of Scope

- No `/message`, `/draft`, `/commit` routes (T118–T120).
- No actual chat input/turns (T118).
- No model integration, no `aiQuota` enforcement (T118).
- No remote/PostgREST flag — that migration is a post-GA follow-up after T123.
- No Privacy disclosure card (T121).
- No Sentry/structured-log hardening (T122).

## Acceptance Criteria

- [ ] `POST /thread { action: "open" }` returns 200 with `{ thread_id, status, resumed }`; refresh resumes the same row (one active row per user enforced via partial unique).
- [ ] `POST /thread { action: "abandon" }` is idempotent and flips the active thread to `abandoned`.
- [ ] Endpoint requires `Authorization: Bearer …` and validates `locale ∈ {'en','fr'}`.
- [ ] `VITE_FEATURE_EMBEDDED_AGENT=false` (or unset) → AI path renders the **legacy** `AIGeneratingStep` (no behavior change).
- [ ] `VITE_FEATURE_EMBEDDED_AGENT=true` → AI path renders the new `EmbeddedAgentChatStep` shell with thread id, status, and Restart button (Story 10).
- [ ] Back to PathChoice from the chat shell abandons the active thread (Story 11).
- [ ] Offline (`navigator.onLine === false` or `/thread` failure) shows the offline banner — no infinite spinner (Story 8).
- [ ] Template/Blank paths never mount the chat, regardless of flag (Story 16).
- [ ] FR/EN strings in place for all new copy; e2e/RTL tests pass; no a11y regression on the wizard.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md`
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295_Phase_B.md`
- Glossary: `file:docs/CONTEXT.md` — `Embedded Agent thread lifecycle`, `Embedded Agent onboarding (v1)`
- Phase A pattern: `file:supabase/functions/mcp-phase-a-proof/index.ts` (auth + structured logs)
