# T119 — Program Draft Step + Edge `/draft` + Ready-Signal + Generate CTA

## Goal

Move the thread from `open` → `preview_ready`. Implement the **Program draft step** (server-side, reusing `generate-program` internals + thread context), wire the `/draft` Edge route with **3 drafts / 24h** + existing `program 5/30d` quotas, parse the **ready-signal** from assistant responses, and add the **"Generate my plan"** CTA in the chat. The route calls **MCP `create_program`** with `dry_run: true` via the Phase A `mcpClient` and stores the resulting payload in `last_preview` (with a 32 KB size guard).

Three triggers, whichever fires first (Tech Plan `Draft triggers`):

1. Assistant emits the machine-readable ready-signal.
2. Assistant turn count reaches 6 (cap).
3. User taps **Generate my plan**.

Addresses Epic Brief stories: **#2**, **#5** (preview material exists).

## Mode

**AFK** — triggers, caps, and dry-run-only persistence are locked.

## Slice

`prompt.ts (ready-signal parser) → draft.ts → embedded-agent (/draft) → mcpClient → MCP create_program (dry_run) → EmbeddedAgentChatStep CTA → Deno + RTL`

## Dependencies

`T118`

## Scope

### `file:supabase/functions/embedded-agent/prompt.ts` — extend

- `parseReadySignal(assistantContent)` — looks for the literal `READY_FOR_PROGRAM_DRAFT: { ... }` line, parses the JSON tail, validates `{ ready: true, summary: string }`. Returns `{ ready: boolean, summary?: string }`. Free-text "I'm ready" returns `{ ready: false }` (Tech Plan + Epic Brief).
- Wire `parseReadySignal` into `/message` (T118 territory but trivial extension here): on a successful assistant reply, set `ready_for_draft = parsed.ready` in the response so the client can flip the CTA visual.

### `file:supabase/functions/embedded-agent/draft.ts`

- `runProgramDraftStep({ supabase, userId, locale, thread, profile })` — internal module.
  - Fetches the catalog the same way `file:supabase/functions/generate-program/index.ts` does (equipment-filtered `exercises`, profile, recent history).
  - Builds an extended prompt: existing `buildProgramPrompt` + the `Embedded Agent` thread transcript + the deterministic onboarding profile.
  - Calls `callGeminiProgram` from `file:supabase/functions/generate-program/gemini.ts`.
  - Validates with `validateProgram` (existing).
  - Returns `{ name, days: [{label, exercises: <prescription objects>}] }` mapped to **MCP `create_program` argument shape** (per `file:supabase/functions/mcp/tools/createProgram.ts`).
- This is **internal**, not a new MCP tool (Story 21).

### `file:supabase/functions/embedded-agent/index.ts` — `/draft` route

- `POST /draft { trigger: 'ready_signal' | 'turn_cap' | 'user_cta', locale }`.
- Auth + active-thread guard (`status === 'open'`; reject 409 otherwise).
- Quota gates, in order:
  1. **Drafts/24h:** count `ai_generation_log` rows where `source = 'embedded_draft'` in last 24h; cap = 3 (whitelist higher).
  2. **Program quota:** existing `checkQuota(..., 'program')` from `file:supabase/functions/_shared/aiQuota.ts` — 5/30d for regular users.
- If either gate fails, return 429 with `{ error: 'draft_quota_exceeded' | 'program_quota_exceeded' }`.
- Run `runProgramDraftStep`. **Always** `logBillableCall(userId, 'embedded_draft')` — success or failure (Story 19).
- Call `callMcpTool` from `file:supabase/functions/_shared/mcpClient.ts` with `toolName: "create_program"`, `arguments: { ...draftArgs, dry_run: true }`.
- On `ok: true`:
  - Build `last_preview` payload: `{ args: draftArgs, rendered: result.value.content[0].text }`.
  - **Size guard**: serialize, check byte length. If `> 32_768` bytes (32 KB), strip `rendered` and store only `args`; the client re-renders preview from `args`. Document the constant `LAST_PREVIEW_MAX_BYTES = 32_768` in `draft.ts`.
  - `setLastPreview(threadId, payload)`; `setStatus(threadId, 'preview_ready')`; bump `draft_count_24h`.
  - Return `{ status: 'preview_ready', preview: payload }`.
- On `ok: false` (rpc / tool / transport error): structured log; return 502 / 422 with friendly body. Status stays `open` so the user can retry from chat (T120's 2-failure escape kicks in client-side).

### `file:src/components/onboarding/EmbeddedAgentChatStep.tsx` — extend

- Add **"Generate my plan"** CTA button. Visibility rules:
  - Hidden until `assistant_turn_count >= 4` (avoid premature CTA on turn 1).
  - Always shown after `assistant_turn_count >= 6` (cap trigger UI hint — server still authoritative).
  - Pulse / highlight when `ready_for_draft === true` from the latest `/message` response.
- On click, fires `useGenerateDraft()` mutation hitting `/draft` with `trigger: 'user_cta'`. Disables compose during draft; shows phase-status microcopy ("reading your answers · drafting · validating · preparing preview") — deterministic strings, not model-driven.
- After server replies `status: 'preview_ready'`, advance the wizard to a new step `embedded_preview` (T120 owns the preview component itself; T119 just sets the wizard state).

### React Query

- `useGenerateDraft()` mutation in `file:src/hooks/useEmbeddedAgentThread.ts`. On 429, surface `{ kind: 'quota', which: 'draft' | 'program' }`.

### Tests

- **Deno** — `prompt_test.ts`: ready-signal parser (happy path, malformed JSON, missing field, false free-text).
- **Deno** — `draft_test.ts`: runs end-to-end with mocked Supabase + mocked Gemini + mocked `callMcpTool`. Verifies arg shape sent to MCP, size guard truncates `rendered` over 32 KB, and `logBillableCall` fires on Gemini failure.
- **Deno** — extend `embedded-agent/index_test.ts`: `/draft` 409 wrong status, 429 either quota, 200 happy path moves status → `preview_ready`, 502 on MCP transport error keeps status `open`.
- **RTL** — `EmbeddedAgentChatStep.test.tsx`: CTA hidden < 4 turns, visible at 6, pulses when ready_for_draft is true; click → mutation → wizard advances.

## Out of Scope

- No preview UI component (T120 — `EmbeddedAgentPreviewStep`).
- No `/commit` route (T120).
- No 2-failure Template/Blank fallback (T120).
- No Privacy disclosure (T121).
- The size-guard constant lives here; if it proves too tight in T120 review, tune in a follow-up — don't block this ticket.

## Acceptance Criteria

- `parseReadySignal` correctly identifies the JSON-tail format and rejects free-text + malformed JSON.
- `/draft` enforces drafts/24h **and** existing program quota (5/30d) before invoking the model.
- `logBillableCall(_, 'embedded_draft')` fires on both success and failure paths.
- On success, MCP `create_program` is called with `dry_run: true` via `mcpClient` (no direct DB writes from `/draft`).
- `last_preview` is stored under 32 KB; oversized payloads strip `rendered` and keep `args`.
- Thread transitions to `preview_ready` on success; stays `open` on MCP failure.
- **Generate my plan** CTA appears at the right turn thresholds and pulses when `ready_for_draft` is true (Story 2).
- After successful draft, the wizard advances to `embedded_preview` (T120 lands the actual screen).
- Tests cover all three trigger paths and both quota failure modes.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md` — Program draft triggers + Quota
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295_Phase_B.md`
- Glossary: `file:docs/CONTEXT.md` — `Program draft step`
- Reused stack: `file:supabase/functions/generate-program/index.ts`, `file:supabase/functions/generate-program/gemini.ts`, `file:supabase/functions/_shared/mcpClient.ts`, `file:supabase/functions/mcp/tools/createProgram.ts`