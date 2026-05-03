# T71 — get_program_details MCP Tool

## Goal

Ship the `get_program_details` MCP tool end-to-end so an AI assistant can fetch the full structure of any program by UUID — days, exercises, sets, reps, weights, rest — regardless of cycle state. Output is markdown with **inline UUIDs on every day and exercise line**, providing the addressable handles that Epic C (`update_program`) will need. Also ships the **first agent-flow example prompt** (*"Review my draft program"*) that exercises the chained `list_programs → get_program_details` flow end-to-end.

Delivers user stories **7–12** of the Epic Brief (drill into a single program, all error and edge states), plus story **15** partially (zero-shot guidance via SKILL.md update) and story **16** partially (first copy-paste prompt).

After this ticket, an agent can run *"hey Iris, montre-moi le programme Mai 2026 v2"* and get a full structured response — including on a draft program with no active cycle, today's blocker.

## Mode

**AFK** — handler logic, formatter, validation, all pinned by the Tech Plan.

## Slice (layers traversed)

`lib/uuid.ts` extraction (refactor) → UUID validation in handler → Postgres nested query (`programs` + `workout_days(*, workout_exercises(*))`) → handler (`getProgramDetails.ts`) → pure formatter (`formatProgramDetails`) → tool registry → Vitest suite extension → SKILL.md update (extend Discovery flow) → first example prompt in `example-prompts.md`.

## Dependencies

**T70** (soft) — for the `Discovery flow` section in `skills/gymlogic-mcp/SKILL.md`. T71 *extends* the section that T70 *creates*. If T71 lands first, the section needs to be created here instead, but no functional code dependency exists. T70 and T71 can be developed in parallel; merge T70 first if possible.

## Scope

### `lib/uuid.ts` extraction

| Item | Detail |
|---|---|
| New file | `supabase/functions/mcp/lib/uuid.ts` |
| Exports | `UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` and `isUuid(s: string): boolean` |
| Refactor | Replace the local `UUID_RE` and `isUuid()` in `file:supabase/functions/mcp/tools/createProgram.ts` (lines 10 and 23-25) with import from `../lib/uuid.ts` |
| Behavior change | None for `createProgram`. Only the import path changes |
| Imports | Use `.ts` extension on the import (Deno compat, like the rest of the MCP folder) |

### Handler — `supabase/functions/mcp/tools/getProgramDetails.ts`

| Item | Detail |
|---|---|
| Input args | `program_id: string` (required, declared in `inputSchema.required`) |
| Auth gate | Same standard pattern as the other 7 tools |
| Validation | `isUuid(program_id)` from `lib/uuid.ts`. Invalid → `isError: true` with `"Invalid program_id format (expected UUID)."` — **before** any DB call |
| Query | `supabase.from("programs").select("id, name, archived_at, workout_days(id, label, emoji, sort_order, workout_exercises(id, name_snapshot, sets, reps, weight, rest_seconds, target_duration_seconds, sort_order))").eq("id", program_id).maybeSingle()` |
| Empty result | `isError: true` with `"Program not found or you don't have access."` — uniform message, no 404/403 distinction |
| Defensive sort | Sort `workout_days` by `sort_order` and `workout_exercises` per day by `sort_order` in JS (Postgres order on nested resources is not guaranteed) |
| Mapping for formatter | Build a `Map<string, WorkoutExercise[]>` keyed by `workout_day_id`. Pass `(program, days, exercisesByDay)` to `formatProgramDetails` |

### Formatter — `formatProgramDetails` in `lib/format.ts`

Pure function. Signature:

```ts
formatProgramDetails(
  program: { id: string; name: string; archived_at: string | null },
  days: Array<{ id: string; label: string; emoji: string; sort_order: number }>,
  exercisesByDay: Map<string, Array<{
    id: string
    name_snapshot: string
    sets: number
    reps: string
    weight: string
    rest_seconds: number
    target_duration_seconds: number | null
  }>>
): string
```

Output format:

```
## **{name}** *(id: {full uuid})*{ (archived) if archived_at != null}

### {emoji} {label} *(id: {day uuid})*
  - **{name_snapshot}** *(id: {ex uuid})*: {sets} × {reps} reps @ {weight} kg (rest {rest_seconds}s)
  - ...

### {emoji} {label} *(id: ...)*
  - ...
```

**Empty-program special case** (0 days): replace the day blocks with one line:

```
_(empty program — no days defined)_
```

**Important**: do NOT call `formatWorkoutDay`. Duplicate the exercise-line rendering logic (~10 lines) intentionally to keep `formatProgramDetails` and `formatWorkoutDay` independent. A change to one must never silently regress the other.

### Vitest suite extension — `lib/format.test.ts`

Add a new `describe("formatProgramDetails")` block to the file created by T70. Cases:

- Single-day program with 2 exercises (happy path, asserts inline UUIDs present on day and exercise lines)
- Multi-day program with mixed exercise counts per day
- Empty program (0 days) → renders the `_(empty program — no days defined)_` line
- Archived program → header includes `(archived)` after the name
- Exercise with `weight = "0"` → omits the ` @ 0 kg` suffix (consistency with `formatWorkoutDay`)
- Exercise with `target_duration_seconds` set instead of reps → renders `{sets} × {N}s` instead of `{sets} × {reps} reps`

### Registry plug — `tools/registry.ts`

Import `getProgramDetails` from `./getProgramDetails.ts` and append to the `tools` array. No other changes.

### Skill doc update — `skills/gymlogic-mcp/SKILL.md`

| Item | Detail |
|---|---|
| Add tool to roster | Insert `get_program_details` row in the existing tool table |
| Extend Discovery flow section | Replace the T71 placeholder (created by T70) with the actual entry, leave the Epic C placeholder for `update_program` |
| Tool description (used in `inputSchema.description`) | *"Get the full structure of a training program by ID — days, exercises, sets, reps, weights, rest. Works regardless of cycle state. Use after list_programs, or with the program_id surfaced by get_upcoming_workouts / get_workout_history. Returns markdown with inline IDs on day and exercise lines for downstream addressability."* |

### Example prompt — `docs/mcp-connect/example-prompts.md` (new file)

Create the file with a one-paragraph intro and the **first** flow:

```markdown
## "Review my draft program before I start it"

User says: "Review my Mai 2026 v2 before I start the cycle."

Expected agent behavior:
1. Call `list_programs` to see what exists (filter by `include_archived: false`).
2. Identify the program matching the name (or ask if multiple match).
3. Call `get_program_details(id)` with the matched UUID.
4. Present a summary highlighting volume per muscle group, antagonist coverage,
   anything that looks off (very short rest periods, very high rep ranges, etc).

Why this works zero-shot: the tool descriptions and the SKILL.md "Discovery
flow" section explicitly chain list → get_details. The agent doesn't need
custom instructions to figure this out, but a system prompt can speed up the
behavior on resistant clients (see "For Claude Desktop" below).

### For Claude Desktop — paste in Custom Instructions

> When the user asks me to review, summarize, compare, or critique any of
> their GymLogic training programs, I will:
> 1. Call `list_programs` first to see all available programs.
> 2. Match the user's intent to a specific program ID, or ask if ambiguous.
> 3. Call `get_program_details(id)` to load the full structure.
> 4. Provide an opinionated review with concrete suggestions.
```

## Out of Scope

- `program_id` annotations in `get_upcoming_workouts` and `get_workout_history` — owned by T72.
- Second example prompt ("Compare two programs side by side") — owned by T72.
- L188 annotation in `SKILL.md` — owned by T72.
- Editing programs (`update_program`) — Epic C.
- Distinguishing "not found" (404) from "not yours" (403) errors — explicit non-goal of the Epic Brief.
- Caching `get_program_details` responses — explicit non-goal.
- Any change to `createProgram.ts` behavior beyond the import refactor.

## Acceptance Criteria

- [ ] `lib/uuid.ts` exists with `UUID_RE` and `isUuid()`, and `createProgram.ts` imports both from there (no local copies remain)
- [ ] Calling `get_program_details(id)` from Iris with a valid UUID returns markdown with the program name and all days/exercises
- [ ] Every day header AND every exercise line carries `*(id: <full uuid>)*` matching `/[0-9a-f-]{36}/i`
- [ ] Calling `get_program_details` with `program_id: "abc"` returns the `"Invalid program_id format (expected UUID)."` error and never hits the DB
- [ ] Calling `get_program_details` with a valid-format UUID that doesn't exist returns the uniform `"Program not found or you don't have access."` error
- [ ] Calling `get_program_details` on an archived program succeeds and shows `(archived)` in the header
- [ ] Calling `get_program_details` on a program with 0 days succeeds and shows the `_(empty program — no days defined)_` line
- [ ] `formatProgramDetails` does NOT internally call `formatWorkoutDay` (verified by grep in PR review)
- [ ] `lib/format.test.ts` has the new `formatProgramDetails` describe block with all 6 cases passing
- [ ] `docs/mcp-connect/example-prompts.md` exists with the "Review my draft program" flow including a copy-paste Custom Instructions block for Claude Desktop
- [ ] Manual validation in **Iris**: the example prompt resolves zero-shot (agent calls `list_programs` then `get_program_details` without manual prompting)
- [ ] No existing test regresses (`npm test` green)

## References

- Epic Brief: [`docs/Epic_Brief_—_MCP_—_Read_Programs_#276.md`](./Epic_Brief_—_MCP_—_Read_Programs_#276.md) — see user stories 7–12, 15, 16
- Tech Plan: [`docs/Tech_Plan_—_MCP_—_Read_Programs_#276.md`](./Tech_Plan_—_MCP_—_Read_Programs_#276.md) — see "Component Responsibilities" for `getProgramDetails.ts` and `formatProgramDetails`, and the "Failure Mode Analysis" table
- Sister ticket: [T70 — list_programs MCP Tool](./T70_—_list_programs_MCP_Tool.md) (creates the SKILL.md Discovery flow scaffold this ticket extends)
- Existing UUID validation source: `file:supabase/functions/mcp/tools/createProgram.ts` lines 10, 23-25
- Existing `formatWorkoutDay`: `file:supabase/functions/mcp/lib/format.ts` (the function we deliberately do NOT call from `formatProgramDetails`)
