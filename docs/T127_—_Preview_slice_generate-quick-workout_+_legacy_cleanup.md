# T127 — Preview slice: `generate-quick-workout` + PWA hook + AIGeneratingStep + legacy cleanup

## Goal

Ship the **preview phase** of Quick Workout AI through the new endpoint: a new `generate-quick-workout` Edge function (port of today's `generate-workout/` with the quota source flipped to `'quick_workout'`), a new PWA hook `useGenerateQuickWorkoutPreview` that replaces `useAIGenerateWorkout`, and a rewired `QuickWorkoutAIGeneratingStep`. Once this lands, AI generation goes through the new code path and **the legacy `generate-workout/` Edge function and `useAIGenerateWorkout` hook have zero callers — both are deleted in this same PR**.

UX is identical: constraints → loading → preview. The migration is invisible to the user; verifiable via `ai_generation_log` (rows now show `source = 'quick_workout'`).

Addresses **Epic Brief stories 1, 2, 3, 4, 5, 6, 17, 19** (preview path) and the locked decisions in **ADR 0002 §3** (two-function shape, preview phase).

## Mode

**AFK** — port + new handler + hook + UI rewire. All architectural decisions locked.

## Slice

migration *(via T126)* → `_shared/programCatalog.ts` *(via T126)* → `generate-quick-workout/handler.ts` + `index.ts` + moved `prompt.ts` / `gemini.ts` / `validate.ts` → quota gate → catalog/profile/history fetch → Gemini → validate-and-repair → `useGenerateQuickWorkoutPreview` PWA hook → `QuickWorkoutAIGeneratingStep` rewire → **delete `generate-workout/` + `useAIGenerateWorkout.ts`** → Vitest unit tests + manual smoke

## Dependencies

- **T126** — depends on `quick_workout` quota source existing and `_shared/programCatalog.ts` being available.

## Scope

### 1. New Edge function `generate-quick-workout/`

| File | Action |
|---|---|
| `file:supabase/functions/generate-quick-workout/prompt.ts` | **`git mv`** from `generate-workout/prompt.ts` (preserve commit history). No content change. |
| `file:supabase/functions/generate-quick-workout/gemini.ts` | **`git mv`** from `generate-workout/gemini.ts`. No content change. |
| `file:supabase/functions/generate-quick-workout/validate.ts` | **`git mv`** from `generate-workout/validate.ts`. No content change. |
| `file:supabase/functions/generate-quick-workout/handler.ts` | **NEW**. Pure handler with deps interface: `{ getUser, checkQuota, fetchCatalog, fetchProfile, fetchRecentHistory, callGemini, logBillableCall, log }`. Order of operations: auth → input validation (equipment allowlist, duration enum, muscle groups) → quota check → catalog/profile/history fetch (via shared helper from T126) → `buildPrompt` → `callGemini` → `validateAndRepair` → log billable call → return `{ exerciseIds, rationale }`. **log_everything**: `logBillableCall(userId, "quick_workout")` runs in `finally` so model failures still credit quota. |
| `file:supabase/functions/generate-quick-workout/index.ts` | **NEW**. Deno.serve wrapper, CORS, DI wiring (creates user/service clients, calls handler). Mirrors `embedded-agent/index.ts`'s thin-wrapper pattern. |

**Equipment allowlist parity**: today's `generate-workout/index.ts:17-21` enforces `equipmentCategories ⊆ {bodyweight, dumbbells, full-gym}` AND rejects mixing `full-gym` with others. The new handler MUST keep this validation byte-identical — `EQUIPMENT_CATEGORY_MAP` in `prompt.ts` only knows these three keys; deviation yields an empty catalog query.

### 2. PWA hook `useGenerateQuickWorkoutPreview`

| File | Action |
|---|---|
| `file:src/hooks/useGenerateQuickWorkoutPreview.ts` | **NEW**. React Query mutation hook, same shape as today's `useAIGenerateWorkout`. POSTs to `${SUPABASE_URL}/functions/v1/generate-quick-workout` with session JWT. On success, hydrates `exerciseIds` against the local `exercises` query (port the logic at `useAIGenerateWorkout.ts:80-103`). Returns `GeneratedWorkout` with full `Exercise` objects so `PreviewStep` doesn't need a second fetch. |

### 3. UI rewire

| File | Change |
|---|---|
| `file:src/components/generator/QuickWorkoutAIGeneratingStep.tsx` | Replace import `useAIGenerateWorkout` with `useGenerateQuickWorkoutPreview`. Spinner / error / fallback UI **unchanged**. The error shape (`quota_exceeded`, network error, model failure) maps 1:1 to existing UI states. |
| `file:src/components/generator/QuickWorkoutSheet.tsx` | **No change in this ticket** — the AI Start path still uses `useCreateQuickWorkout` (raw insert). T128 wires `useCommitQuickWorkout` for the AI Start path. Intermediate state: AI generation goes through new endpoint, save still uses raw insert. Coherent and demoable. |

### 4. Legacy cleanup (delete files with zero remaining callers)

| File | Reason |
|---|---|
| `file:supabase/functions/generate-workout/` (whole folder) | Replaced by `generate-quick-workout/`. Zero callers after the hook rewire. |
| `file:src/hooks/useAIGenerateWorkout.ts` | Replaced by `useGenerateQuickWorkoutPreview`. Zero callers after `QuickWorkoutAIGeneratingStep` is rewired. |

**Why both deletions in this ticket and not later**: at the moment T127 merges, both files have zero callers. Deferring deletion to a separate ticket adds nothing — there's no intermediate state where the old code is needed.

### 5. Structured logging

At least one error path emits a structured log line (matching `embedded-agent`'s `LogEvent` shape: `{ level, feature: "generate-quick-workout", route: "/generate", error_kind, request_id, user_id, message }`). Suggested first log point: provider failure on Gemini call. Story 17 coverage.

### 6. Tests

| Layer | Coverage |
|---|---|
| Vitest — `generate-quick-workout/handler.test.ts` | Happy path with mocked deps; quota gate fires before model call (assert `callGemini` not called when quota denied); log_everything (assert `logBillableCall` runs even when `callGemini` throws); equipment allowlist rejection; structured log emitted on provider failure |
| Vitest — `useGenerateQuickWorkoutPreview.test.tsx` | Hook hydrates `exerciseIds` against local pool; error mapping (`quota_exceeded`, `model_failure`, network) |
| Deno parity (if applicable) | If today's `generate-workout/` has a Deno test, port it to the new folder |
| Manual smoke | Open Quick Workout → AI tab → fill constraints → see workout generated; verify a `quick_workout` row appears in `ai_generation_log` |

## Out of Scope

- AI Start (write path) — still uses `useCreateQuickWorkout` until T128
- `commit-quick-workout` Edge function (T128)
- Playwright E2E (T128 — establishes the mocked-Gemini pattern across the full preview + commit flow)
- `generate-program/` deletion (T129, conditional on #343)
- Quota source migration / per-source cap refactor (T126)

## Acceptance Criteria

- [ ] `supabase/functions/generate-quick-workout/` exists with `index.ts`, `handler.ts`, `prompt.ts`, `gemini.ts`, `validate.ts`. The latter three preserve commit history (`git mv`).
- [ ] `supabase/functions/generate-workout/` is **deleted** — `git status` shows the folder as removed; no remaining grep hits in the repo.
- [ ] `src/hooks/useAIGenerateWorkout.ts` is **deleted**; `git grep useAIGenerateWorkout` returns zero results.
- [ ] `src/hooks/useGenerateQuickWorkoutPreview.ts` exists, posts to `/functions/v1/generate-quick-workout`, hydrates `exerciseIds`, returns `GeneratedWorkout`.
- [ ] `QuickWorkoutAIGeneratingStep` imports the new hook; spinner / error / fallback UI is visually identical (no copy / layout changes).
- [ ] Manual smoke: opening the Quick Workout sheet on the AI tab, filling constraints, hitting Generate produces a preview within 6s. The user-facing flow is byte-identical.
- [ ] After a successful generate, `ai_generation_log` shows a row with `source = 'quick_workout'` for the test user. After a Gemini-failure path (mocked), the same row appears (log_everything).
- [ ] Vitest handler suite asserts: quota gate before Gemini, log_everything on model failure, equipment allowlist rejection, structured log emitted on at least one error path.
- [ ] Save-as-draft on the AI path **continues to work** (still uses `useCreateQuickWorkout`, unchanged in this ticket).
- [ ] Deterministic Quick Workout flow continues to work (untouched by this ticket).

## References

- [Epic Brief — Quick Workout AI to Embedded Agent + MCP (#342)](./Epic_Brief_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — stories 1-6, 17, 19
- [Tech Plan — Quick Workout AI to Embedded Agent + MCP (#342)](./Tech_Plan_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — sections "Component Responsibilities → generate-quick-workout/handler.ts", "Modified files", "Deleted files"
- [ADR 0002 — Quick Workout AI MCP migration](./adr/0002-quick-workout-ai-mcp-migration.md) — §3 (two-function shape, preview phase)
- Reference: `file:supabase/functions/embedded-agent/handler.ts` (handler+deps pattern), `file:supabase/functions/generate-workout/index.ts` (legacy implementation to port + retire)
