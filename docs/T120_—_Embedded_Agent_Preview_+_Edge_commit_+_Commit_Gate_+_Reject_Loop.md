# T120 — Embedded Agent Preview + Edge `/commit` + Commit Gate + Reject Loop

## Goal

Close the **Onboarding program commit gate**. Add the `/commit` Edge route (calls MCP `create_program` with `dry_run: false` using the stored `last_preview`), build the `**EmbeddedAgentPreviewStep`** UI that renders the preview and exposes Confirm / Regenerate, wire reject → continue same thread → re-draft, and ship the **2-consecutive-failure escape** to Template/Blank. End-to-end happy path: questionnaire → chat → preview → confirm → active program persisted via MCP.

Addresses Epic Brief stories: **#5**, **#6**, **#7**, **#14**, **#15**.

## Mode

**AFK** — commit gate semantics are locked in `file:docs/CONTEXT.md`.

## Slice

`embedded-agent (/commit) → mcpClient → MCP create_program (dry_run:false) → EmbeddedAgentPreviewStep.tsx → fallback nav → Deno + RTL`

## Dependencies

`T119`

## Scope

### `file:supabase/functions/embedded-agent/index.ts` — `/commit` route

- `POST /commit { confirm: true }`. Reject 400 if `confirm !== true` (defense in depth — the commit gate is server-trusted, not just UI).
- Auth via `supabase.auth.getUser()`. Resolve active thread; reject 409 if `status !== 'preview_ready'` or `last_preview` is missing.
- Call `callMcpTool` with `toolName: "create_program"`, `arguments: { ...last_preview.args, dry_run: false }`.
- On success:
  - Parse `program_id` from MCP response text.
  - `setStatus(threadId, 'committed', { program_id, summary })` — `summary` built deterministically (no extra model call) from the structured profile + minimal extracted signals (e.g. `injuries: ['shoulder']`) — implementation in `threadStore.buildDeterministicSummary` (added here).
  - **Purge raw transcript** (`messages = null`) as part of `setStatus('committed')` from T116.
  - Return `{ program_id }`.
- On MCP failure (`tool_error` / `rpc_error` / `transport_error`):
  - **Status stays `preview_ready`** so the user can retry commit without losing the preview (Tech Plan failure mode table).
  - Structured log; return 502 + friendly body `{ error: 'commit_failed', kind, message }`.

### `file:src/components/onboarding/EmbeddedAgentPreviewStep.tsx`

- Reads `last_preview` from the thread query.
- If `last_preview.rendered` is present, render those `String[]` lines per day inside `<Card>`s.
- If only `last_preview.args` are present (size-guard fallback from T119), render client-side from `args` (reuse `formatPrescriptionLine` shape from `file:supabase/functions/mcp/lib/format.ts` — port a thin client helper if needed).
- Two CTAs:
  - **Confirm and activate** — `useCommit()` mutation. On success → fire `program_created` analytics event (with `path: 'ai'`) → `navigate('/', { replace: true })`. On failure → toast + retry button (preview stays).
  - **Regenerate / continue chat** — fires `useReject()` (client-only): pops the wizard back to `embedded_chat`, leaves `last_preview` in place but re-prompts the model with a "user rejected the previous draft" assistant turn (server transitions thread back to `open` and clears `last_preview`).
- **2-failure escape**: client-side counter (sessionStorage, scoped to thread id) that increments on each draft/preview failure (from T119) **or** commit failure here. When `>= 2`, show inline `<Alert>` with "Try a template or start blank" CTAs that route to `recommendation` / `handleAIFallbackBlank` in `OnboardingPage` (Story 15).

### `file:supabase/functions/embedded-agent/index.ts` — `/reject` route (small)

- `POST /reject` — sets `status` back to `open` and clears `last_preview`. Idempotent. Re-allows `/draft` for that thread (subject to quota). This avoids the client guessing thread state.

### `file:supabase/functions/embedded-agent/threadStore.ts` — extend

- `buildDeterministicSummary({ profile, last_preview, signals })` — pure function, no model call. Composes a one-paragraph string like:
  > AI onboarding program created. Goal: hypertrophy · 4 d/wk · 60 min · full-gym. Notable input from chat: shoulder injury (avoid OHP). Program: 4 days, 24 exercises.
- Return value goes into `embedded_agent_threads.summary` on commit.

### `file:src/pages/OnboardingPage.tsx` — wiring

- Add `WizardStep` value `embedded_preview`.
- Render `EmbeddedAgentPreviewStep` when `step === 'embedded_preview'`.
- Wire `onRegenerate` → `useReject()` then `setStep('embedded_chat')`.
- Wire `onFallbackTemplate` → `setStep('recommendation')`.
- Wire `onFallbackBlank` → existing `handleAIFallbackBlank`.

### React Query — `file:src/hooks/useEmbeddedAgentThread.ts` extend

- `useCommit()` — mutation hitting `/commit`.
- `useReject()` — mutation hitting `/reject`. Invalidates the thread cache.

### Tests

- **Deno** — extend `embedded-agent/index_test.ts`:
  - `/commit` rejects without `confirm: true` (400).
  - `/commit` 409 when `status !== 'preview_ready'`.
  - Happy path: MCP called with `dry_run: false`, status → `committed`, `messages` cleared, `program_id` + `summary` written.
  - MCP failure path: status stays `preview_ready`; preview retrievable for retry.
  - `/reject` flips back to `open` and clears `last_preview`.
- **Deno** — `threadStore_test.ts` extend: `buildDeterministicSummary` returns deterministic output for the same input; never references model output.
- **RTL** — `EmbeddedAgentPreviewStep.test.tsx`:
  - Renders rendered preview lines.
  - Confirm → success → navigate to `/`.
  - Confirm → MCP failure → toast + retry button visible; preview still rendered.
  - Regenerate → invokes reject + steps back to chat.
  - Two consecutive failures → fallback `<Alert>` with Template/Blank CTAs.

## Out of Scope

- No analytics rename for `ai_`* events (T123).
- No flag flip — feature stays default-off until T123.
- No structured-log hardening (T122).
- No removal of the legacy `AIProgramPreviewStep` — still in use under flag-off (removed in T123).

## Acceptance Criteria

- `/commit` only persists when the request body has `confirm: true` and the thread status is `preview_ready` (Story 6 — agent proposes, user decides).
- On success, MCP `create_program` is called with `dry_run: false`; thread becomes `committed`; raw `messages` purged; `summary` and `program_id` written.
- On MCP failure, thread stays `preview_ready` so the user can retry commit without losing the preview.
- Reject path puts the thread back to `open`, clears `last_preview`, and lets the user keep chatting in the **same thread** (Story 7).
- Preview screen renders cleanly from `rendered` lines, falling back to `args` when the size guard kicks in.
- Two consecutive failures (draft or commit) show the Template/Blank escape (Story 15).
- Friendly error UX everywhere — never a raw MCP / RPC dump (Story 14).
- Happy path E2E: AI path with flag on → chat → CTA → preview → confirm → land on `/` with active program.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md`
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295_Phase_B.md` — Failure Mode Analysis
- Glossary: `file:docs/CONTEXT.md` — `Onboarding program commit gate`, `Embedded Agent error handling (v1)`, `Embedded Agent thread retention`
- MCP commit shape: `file:supabase/functions/mcp/tools/createProgram.ts`