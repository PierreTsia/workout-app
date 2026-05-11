# T128 — Write slice: `commit-quick-workout` + `useCommitQuickWorkout` + Sheet wiring + Playwright E2E

## Goal

Close the migration loop: ship the **write phase** of Quick Workout AI through MCP. New `commit-quick-workout` Edge function calls the `create_workout_day` MCP tool (T124) server-to-server with the user's session JWT; new `useCommitQuickWorkout` PWA hook routes the AI Start path through it; `QuickWorkoutSheet` tracks `generationSource` to pick the right write hook. The deterministic Start path and save-as-draft (both AI and deterministic) continue to use `useCreateQuickWorkout` unchanged.

A mandatory Playwright E2E locks the happy path (constraints → AI generate → preview with edit → Start → workout in upcoming list) using `page.route()` to mock Gemini — **the real Gemini API is never called from CI, no token burn**.

Addresses **Epic Brief stories 7, 8, 11, 18, 20** (write path) and **Tech Plan's mandatory E2E with mocked LLM**.

## Mode

**AFK** — Edge function + hook + Sheet wiring + Playwright spec. All architectural decisions locked.

## Slice

`commit-quick-workout/handler.ts` + `index.ts` → MCP RPC via `callMcpTool` → extract `_shared/mcpClient.ts#resolveMcpUrl` → `useCommitQuickWorkout` PWA hook → `QuickWorkoutSheet` `generationSource` branching + `workoutToMcpExercises` util → Vitest unit tests → **Playwright E2E with mocked Gemini**

## Dependencies

- **T124** — needs `create_workout_day` MCP tool live and registered.
- **T127** — needs `generate-quick-workout` to be the AI generate path so the E2E covers a coherent end-to-end flow.

## Scope

### 1. New Edge function `commit-quick-workout/`

| File | Action |
|---|---|
| `file:supabase/functions/commit-quick-workout/handler.ts` | **NEW**. Pure handler with deps interface `{ getUser, callMcp, log }`. Defensive shape check on `body.exercises[]` (1..20, each entry is string OR object with required fields). Calls `callMcpTool({ mcpUrl: resolveMcpUrl(), userAccessToken, toolName: "create_workout_day", arguments: { label, exercises, dry_run: false } })`. Maps MCP errors to wire codes: `rpc_error` / `tool_error` / `transport_error` → 502 with `kind`. Parses `workout_day_id` from MCP success response (defensive: 502 on missing field, same pattern as `embedded-agent/handler.ts:347-364`). **No quota** — the LLM call already paid in T127. |
| `file:supabase/functions/commit-quick-workout/index.ts` | **NEW**. Deno.serve wrapper + DI wiring (mirrors `embedded-agent/index.ts`). |

### 2. Extract `_shared/mcpClient.ts#resolveMcpUrl`

Today, `resolveMcpUrl()` lives inline in `embedded-agent/index.ts:244-252`. With `commit-quick-workout` becoming the third caller (after `embedded-agent` and any future server-to-MCP integration), it earns the rule of three.

| File | Change |
|---|---|
| `file:supabase/functions/_shared/mcpClient.ts` | Add `export function resolveMcpUrl(): string` — env var `MCP_URL` → `${SUPABASE_URL}/functions/v1/mcp` fallback → throw if neither set. Internal Supabase function-to-function URL, NOT the public Cloudflare-fronted `https://mcp.gymlogic.me/functions/v1/mcp`. Rationale: lower latency (no CDN hop), better reliability (no public DNS dependency), identical auth (Bearer JWT works on both). |
| `file:supabase/functions/embedded-agent/index.ts` | Replace local `resolveMcpUrl` (lines 244-252) with import from the shared module. Delete the inline copy. |

### 3. PWA hook `useCommitQuickWorkout`

| File | Action |
|---|---|
| `file:src/hooks/useCommitQuickWorkout.ts` | **NEW**. React Query mutation. POSTs `{ label, exercises[] }` (post-edit payload) to `${SUPABASE_URL}/functions/v1/commit-quick-workout` with session JWT. On success, returns `{ workout_day_id }` and invalidates the same query keys as `useCreateQuickWorkout` (upcoming workouts, sessions). Error mapping (kind → toast copy): `rpc_error` → "Server error, retry"; `tool_error` → "Workout couldn't be saved"; `transport_error` → "Network issue". |

### 4. `QuickWorkoutSheet` wiring

| File | Change |
|---|---|
| `file:src/components/generator/QuickWorkoutSheet.tsx` | Add `const [generationSource, setGenerationSource] = useState<"ai"\|"deterministic">("deterministic")`. Set to `"ai"` on entering `AIGeneratingStep`; reset to `"deterministic"` on regenerate-as-deterministic fallback. `handleStart` branches: `generationSource === "ai"` → `commitQuickWorkout.mutate({ label: workout.name, exercises: workoutToMcpExercises(workout) })`; otherwise → existing `createQuickWorkout.mutate(workout)`. `handleSaveAsDraft` always uses `createQuickWorkout` (drafts skip MCP entirely). |
| `file:src/lib/quickWorkout.ts` (or co-located util) | **NEW** `workoutToMcpExercises(workout: GeneratedWorkout)` — map hydrated `GeneratedExercise[]` to the MCP wire shape (object form with all required fields). |

### 5. Mandatory Playwright E2E

| File | Action |
|---|---|
| `file:e2e/quick-workout-ai.spec.ts` | **NEW** single happy-path spec. Uses `page.route('**/generate-quick-workout', ...)` to return a deterministic stub response (`{ exerciseIds: [...], rationale: "stub" }`). |

**Test flow**:
1. Open Quick Workout sheet
2. Switch to AI tab
3. Fill constraints (use the seeded test user's profile from `e2e/global-setup.ts`)
4. Hit Generate → `page.route` intercepts the call, returns stub
5. Preview renders with the stubbed exercises
6. Edit one set count (e.g. change "3 sets" → "4 sets")
7. Hit Start → real `commit-quick-workout` is called (MCP write path is real, only Gemini is mocked)
8. Assert workout appears in upcoming list with `program_id IS NULL`, `label`, the edited set count

**No real Gemini call** — `page.route` ensures the network request to `/generate-quick-workout` never reaches the Edge function. CI never burns tokens.

The seeded test user has a profile + active program from `global-setup.ts:88-118`. The new `workout_days` row created in step 8 has `program_id: NULL` (independent of the seeded program — verifies the locked `destructiveHint: false` behavior end-to-end).

### 6. Tests

| Layer | Coverage |
|---|---|
| Vitest — `commit-quick-workout/handler.test.ts` | Happy path with mocked `callMcp`; defensive shape check (bad `exercises[]` shapes → 400); MCP `rpc_error` / `tool_error` / `transport_error` → 502 with correct `kind`; `workout_day_id` parsing (success vs missing-field 502); structured log emitted on at least one error path |
| Vitest — `useCommitQuickWorkout.test.tsx` | Error → toast copy mapping; success → query invalidation |
| Vitest — `quickWorkout.test.ts` | `workoutToMcpExercises` produces correct wire shape for reps / duration / bodyweight branches |
| Vitest — `QuickWorkoutSheet.test.tsx` (extension) | `generationSource = "ai"` → `useCommitQuickWorkout`; `generationSource = "deterministic"` → `useCreateQuickWorkout`; save-as-draft always uses `useCreateQuickWorkout` |
| Playwright | The single E2E spec above |

## Out of Scope

- `generate-quick-workout` Edge function (T127)
- New MCP tool (T124)
- `useCreateQuickWorkout` refactor (T125)
- `generate-program/` deletion (T129)
- Server-side idempotency on Start (client `isPending` is enough for v1; revisit if double-submits show up in production logs)

## Acceptance Criteria

- [ ] `supabase/functions/commit-quick-workout/` exists with `index.ts` + `handler.ts`. Handler is a pure function with deps interface, testable without Deno.
- [ ] `_shared/mcpClient.ts` exports `resolveMcpUrl()`; `embedded-agent/index.ts:244-252` is removed and replaced by an import.
- [ ] `src/hooks/useCommitQuickWorkout.ts` exists, POSTs the post-edit payload `{ label, exercises[] }`, returns `{ workout_day_id }`, invalidates upcoming-workouts queries.
- [ ] `QuickWorkoutSheet` tracks `generationSource`; AI Start uses `useCommitQuickWorkout`; deterministic Start and both save-as-draft paths use `useCreateQuickWorkout` (unchanged for those paths).
- [ ] Manual smoke: AI Start writes a `workout_days` row with `program_id IS NULL` AND **does not deactivate the user's active program** (the locked `destructiveHint: false` behavior).
- [ ] Manual smoke: deterministic Start still works (uses `useCreateQuickWorkout`, raw insert path).
- [ ] Manual smoke: save-as-draft works on both AI and deterministic paths (both use `useCreateQuickWorkout`).
- [ ] Playwright `e2e/quick-workout-ai.spec.ts` passes in CI. The Gemini API is never called (verified by absence of any outbound request to `generativelanguage.googleapis.com` in the test logs).
- [ ] Vitest suites cover all listed cases; structured log emitted on at least one error path in the commit handler (matching `embedded-agent`'s `LogEvent` shape).
- [ ] Auth dualism check: a unit test asserts `commit-quick-workout` accepts session JWT (the PAT path is exercised by T124's MCP tool tests, not duplicated here).

## References

- [Epic Brief — Quick Workout AI to Embedded Agent + MCP (#342)](./Epic_Brief_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — stories 7, 8, 11, 18, 20; mandatory E2E in success measures
- [Tech Plan — Quick Workout AI to Embedded Agent + MCP (#342)](./Tech_Plan_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — sections "Component Responsibilities → commit-quick-workout/handler.ts, useCommitQuickWorkout, QuickWorkoutSheet", "MCP URL resolution", "Test Strategy → Playwright E2E"
- [ADR 0002 — Quick Workout AI MCP migration](./adr/0002-quick-workout-ai-mcp-migration.md) — §3 (two-function shape, commit phase)
- Reference: `file:supabase/functions/embedded-agent/handler.ts` (commit handler pattern + MCP error mapping at lines 200-319), `file:supabase/functions/_shared/mcpClient.ts` (existing `callMcpTool`), `file:e2e/global-setup.ts` (test user / profile / program seeding), `file:e2e/onboarding.spec.ts` (existing Playwright pattern)
