# T124 — MCP tool `create_workout_day` + SKILL.md update

## Goal

Ship the **server-side** half of the Quick Workout AI migration: a new MCP write tool **`create_workout_day`** that creates a single ad-hoc `workout_days` row (`program_id: NULL`) without deactivating any active program, plus the SKILL.md update that exposes it to External MCP Clients (Claude Desktop, Cursor, Le Chat). Once this lands, External Clients can create one-off workouts on day 1 — the in-app PWA migration follows in T127 / T128.

Addresses **Epic Brief stories 12, 13, 14, 15** (External MCP Client surface) and the locked decisions in **ADR 0002 §2** (new tool vs. reusing `create_program`).

## Mode

**AFK** — all decisions locked in Tech Plan / ADR 0002. Mechanical implementation.

## Slice

`mcp/tools/createWorkoutDay.ts` + `tools/registry.ts` + `skills/gymlogic-mcp/SKILL.md` → Vitest unit tests → MCP Inspector smoke

## Dependencies

None. Does not depend on T126 (quota migration) — the MCP tool itself does not touch `ai_generation_log`; quota lives in the Edge function.

## Scope

### MCP tool implementation

| File | Purpose |
|---|---|
| `file:supabase/functions/mcp/tools/createWorkoutDay.ts` | New tool handler. Auth (PAT or session JWT via `authLogic`) → input validation → fetch catalog by IDs (`fetchExercisesByIds`) → `validateDayExercises` → `buildWorkoutExerciseInsertRowsForDay` → insert `workout_days` + `workout_exercises`. Full `dry_run` rendered output. ~150 LoC. |
| `file:supabase/functions/mcp/tools/registry.ts` | Add `createWorkoutDay` entry in the `tools` array. |

### Input schema

```typescript
{
  type: "object",
  required: ["label", "exercises"],
  properties: {
    label: { type: "string", minLength: 1, maxLength: 100 },
    exercises: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: { oneOf: [
        { type: "string", description: "Bare UUID; defaults applied" },
        { type: "object", required: ["exercise_id","sets","reps","weight_kg","rest_seconds"], properties: { /* parity with create_program's exercise object */ } }
      ]}
    },
    dry_run: { type: "boolean", default: false }
  }
}
```

**`emoji` is intentionally NOT in the schema** — server hardcodes `"⚡"` (Quick Workout's visual identity). v2 follow-up if External Clients ask for customization.

### Persisted shape (write branch)

`workout_days` row:
- `program_id: NULL`
- `label: args.label`
- `emoji: "⚡"`
- `sort_order: 0`
- `saved_at: NULL` (live workout, NOT a draft)
- `user_id` from auth context

`workout_exercises` rows: built via `buildWorkoutExerciseInsertRowsForDay` from `file:supabase/functions/mcp/lib/programPersistence.ts`. Identical shape to the rows `create_program` writes for any day — that's the whole point.

### Output shape

| Mode | Response |
|---|---|
| `dry_run: false` (write) | `{ workout_day_id: <uuid>, exercises_count: <n> }` |
| `dry_run: true` (preview) | `{ rendered: ["Bench Press — 4 × 8 × 80 kg total — 120s rest", ...], dry_run: true, note: "workout_day_id omitted; server assigns UUID on insert. Re-call with dry_run: false to persist." }` |

Per-row rendering: reuse the inline loop pattern at `file:supabase/functions/mcp/tools/createProgram.ts:314-347`. If duplication grates after this ticket, extract a `renderExerciseRow` helper as a follow-up — low-risk implementation detail.

### SKILL.md update (`file:skills/gymlogic-mcp/SKILL.md`)

| Section | Change |
|---|---|
| Intro (line 13) | "ten tools" → "eleven tools"; "eight reads, two writes" → "eight reads, three writes" |
| "Tool reference (intent → tool)" (line 66) | Same count update |
| "When to invoke this skill" (line 21-32) | Add Quick Workout intent examples in FR + EN: *"crée-moi une séance d'aujourd'hui"*, *"I want a quick workout for today, just one session"* |
| "Intent → tool" table (line 81-92) | New row for `create_workout_day`. Notes column contrasts with `create_program`: single ad-hoc day, **does NOT deactivate the active program**, max 20 exercises, `program_id: NULL` |
| `create_program` row (line 91) | Light amend: *"For a single ad-hoc workout that should not replace the user's active program, use `create_workout_day` instead."* |
| New "Pattern 5 — Quick ad-hoc workout" | Worked example: `resolve_exercises` → `create_workout_day` with `dry_run: true` → echo `rendered` → `dry_run: false`. Headline differentiator: *"the user's active program stays active"* |
| Parameter format conventions (line 510-520) | Add `create_workout_day` limits: max 20 exercises, label 1..100 chars |
| Edge cases table (line 491-506) | New row: *"User wants a one-off session (today's workout) without replacing their program"* → `create_workout_day` (NEVER `create_program`) |
| Propose-confirm-act handshake (line 110-112) | One-line confirmation: applies to `create_workout_day` too; same field-drop failure mode |

## Out of Scope

- PWA / Edge function wiring (T127, T128)
- Quota source migration + `quick_workout` CHECK extension (T126)
- `_shared/programCatalog.ts` extraction (T126)
- `useCreateQuickWorkout` refactor + shape-parity test (T125)
- Per-row rendering helper extraction (follow-up if duplication grates)

## Acceptance Criteria

- [ ] `create_workout_day` is registered in `tools/registry.ts` and listed by `tools/list` JSON-RPC.
- [ ] Calling `create_workout_day` with `dry_run: true` returns a `rendered: [...]` array of per-exercise echo lines and **does not write to the database** (asserted by row-count check before/after).
- [ ] Calling `create_workout_day` with `dry_run: false` inserts exactly one `workout_days` row (`program_id IS NULL`, `label = args.label`, `emoji = '⚡'`, `sort_order = 0`, `saved_at IS NULL`) and matching `workout_exercises` rows; response shape `{ workout_day_id, exercises_count }`.
- [ ] **Active program parity**: integration test asserts that calling `create_workout_day` for a user with an active program does NOT deactivate the program (the deactivation logic at `createProgram.ts:430-443` MUST NOT fire here).
- [ ] Validation rejects, with a structured `tool_error` carrying the violating field locator: missing `label`, empty `exercises`, > 20 exercises, non-UUID `exercise_id`, cross-field violations (bodyweight + weight_kg > 0; duration + non-"0" reps; etc — `validateDayExercises` paths).
- [ ] Auth dualism: calling with PAT (`Authorization: Bearer glp_...`) and session JWT (`Authorization: Bearer eyJ...`) both succeed (parity with `create_program`'s `authLogic.ts:80-82` path).
- [ ] SKILL.md tool counts updated (eleven / three writes); intent table has a `create_workout_day` row contrasting with `create_program`; Pattern 5 worked example present; edge case row present; parameter format limits added.
- [ ] MCP Inspector smoke: connect, invoke `create_workout_day` with both `dry_run: true` and `dry_run: false`, screenshots in PR description.
- [ ] Vitest suite for `mcp/tools/createWorkoutDay.ts` covers: happy path (bare UUID + object form), `dry_run` rendering, validation rejection paths, auth dualism.

## References

- [Epic Brief — Quick Workout AI to Embedded Agent + MCP (#342)](./Epic_Brief_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — stories 12, 13, 14, 15
- [Tech Plan — Quick Workout AI to Embedded Agent + MCP (#342)](./Tech_Plan_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — sections "Data Model", "Component Responsibilities → mcp/tools/createWorkoutDay.ts", "Skill update scope"
- [ADR 0002 — Quick Workout AI MCP migration](./adr/0002-quick-workout-ai-mcp-migration.md) — §2 (new tool vs. reuse)
- Reference implementations: `file:supabase/functions/mcp/tools/createProgram.ts` (`dry_run` rendering, validation order), `file:supabase/functions/mcp/lib/createProgramValidation.ts` (`validateDayExercises`), `file:supabase/functions/mcp/lib/programPersistence.ts` (`buildWorkoutExerciseInsertRowsForDay`), `file:supabase/functions/mcp/tools/updateProgram_test.ts` (test pattern)
