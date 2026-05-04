# T72 — program_id Surfacing in Existing Tools

## Goal

Surface `program_id` in the responses of `get_upcoming_workouts` and `get_workout_history` so an AI assistant can chain into `get_program_details(id)` from any context — *"modifie ce programme"* after seeing upcoming workouts, *"montre la structure de ce programme"* after a session retrospective. Also annotates L188 of the MCP skill doc with the forward-looking Epic C note, and ships the **second example prompt** (*"Compare two programs side by side"*) which exercises the program_id chaining from upcoming workouts.

Delivers user stories **13** and **14** of the Epic Brief (chain into adjacent tools), plus story **15** partially (zero-shot guidance) and story **16** partially (second copy-paste prompt).

After this ticket, the existing two surfaces gain addressable program handles without changing their core behavior — pure enrichment.

## Mode

**AFK** — both extensions are mechanical, no design call mid-flight.

## Slice (layers traversed)

`formatSessionSummary` extension (presentation) → header tweak in `getUpcomingWorkouts.ts` (1 line) → nested cycles→programs Supabase select in `getWorkoutHistory.ts` (data) → Vitest cases for new branch → SKILL.md update (program_id surfacing + L188 annotation) → second example prompt in `example-prompts.md`.

## Dependencies

**None hard.** Touches different files than T70 and T71 (`getUpcomingWorkouts.ts`, `getWorkoutHistory.ts`, `formatSessionSummary` extension, append to `example-prompts.md`). Can be developed in parallel with T70 and T71 by another agent.

Soft note: if T71 hasn't yet created `docs/mcp-connect/example-prompts.md`, this ticket creates it instead and drops only the second prompt; T71's first prompt gets prepended later. Symmetric, no Git pain.

## Scope

### Formatter extension — `formatSessionSummary` in `lib/format.ts`

Modify the existing `formatSessionSummary(session, sets)` signature to accept a third optional argument:

```ts
formatSessionSummary(
  session: SessionForFormat,
  sets: SetForFormat[],
  programInfo?: { id: string; name: string }
): string
```

Behavior:

| Case | Output |
|---|---|
| `programInfo` is provided (`id` and `name` both non-empty) | Header line becomes `### {workout_label_snapshot} — {date} *(program: {name}, id: {id})*` |
| `programInfo` is omitted OR `programInfo.id` is empty | Header line is identical to today: `### {workout_label_snapshot} — {date}` (no regression for existing callers) |

The check must be defensive — `programInfo === undefined` AND `(programInfo === null)` AND `programInfo?.id == null` all collapse to "omit the annotation". This handles the `cycle_id IS NULL` legacy data case in `get_workout_history` cleanly.

### Vitest cases — `lib/format.test.ts`

Add a new `describe("formatSessionSummary — programInfo branch")` block (or extend the existing `formatSessionSummary` describe if one exists) with cases:

- Without `programInfo` arg → header line unchanged from current behavior (regression guard)
- With `programInfo: { id: "<uuid>", name: "Mai 2026 v2" }` → header includes `*(program: Mai 2026 v2, id: <uuid>)*`
- With `programInfo: undefined` explicitly → same as without arg
- With `programInfo: { id: "", name: "X" }` (empty id) → annotation omitted (defensive guard)
- Full UUID (36 chars) renders correctly in the header

### Handler tweak — `tools/getUpcomingWorkouts.ts`

One-line change in the markdown header at the bottom of the handler. Currently:

```ts
text: `## Upcoming Workouts — ${program.name}\n\n${blocks.join("\n\n")}`
```

Becomes:

```ts
text: `## Upcoming Workouts — ${program.name} *(id: ${program.id})*\n\n${blocks.join("\n\n")}`
```

No other behavior change. The existing select already fetches `program.id` (line 33: `.select("id, name")`), so no Supabase change.

### Handler extension — `tools/getWorkoutHistory.ts`

| Item | Detail |
|---|---|
| Supabase select extension | Extend the existing select on `sessions` to nest `cycle:cycles(program:programs(id, name))`. Exact field path may need adjustment based on the existing query shape — read `getWorkoutHistory.ts` first |
| Per-session mapping | For each session, derive `programInfo`: `session.cycle?.program ? { id: session.cycle.program.id, name: session.cycle.program.name } : undefined` |
| Pass to formatter | Forward `programInfo` as the 3rd arg to `formatSessionSummary` for each session |
| Sessions without cycle (`cycle_id IS NULL`, legacy data) | Fall through to `programInfo: undefined`. Formatter omits the annotation cleanly — verified by the formatter's defensive check |

### Skill doc update — `skills/gymlogic-mcp/SKILL.md`

| Item | Detail |
|---|---|
| Document program_id surfacing | Add a sentence in the section describing each of `get_upcoming_workouts` and `get_workout_history` noting that `*(id: ...)*` is now part of the response and can be passed directly to `get_program_details` |
| Annotate L188 (the *"single-day editing is out of scope for MCP"* entry) | **Preserve the original line**, add a follow-up sentence: *"Single-day program editing arrives in Epic C (`update_program`) — until then, `create_program` is still the only write surface."* Do NOT remove the original line — that happens in Epic C |

### Example prompt — append to `docs/mcp-connect/example-prompts.md`

Append the **second** flow:

```markdown
## "Compare two programs side by side"

User says: "Compare Avril 2026 vs Mai 2026 v2."

Expected agent behavior:
1. Call `list_programs` to find both program IDs by name.
2. Call `get_program_details` twice (in parallel if the runtime supports it)
   on the two IDs.
3. Return a side-by-side diff: muscles covered, total volume per muscle,
   exercise overlap, structural differences (number of days, weekly split).

Variant — when the user is mid-cycle and wants to compare against what's
coming up rather than naming a second program:

1. Call `get_upcoming_workouts` to get the active program's id (now surfaced
   in the response header).
2. Call `list_programs(include_archived: true)` to find the candidate
   alternative.
3. Call `get_program_details` on the alternative.
4. Compare against what was returned by `get_upcoming_workouts` directly.

This second variant only works because `get_upcoming_workouts` now returns
the active `program_id` in its header — the bridging change from T72.
```

If `docs/mcp-connect/example-prompts.md` doesn't exist (T71 not merged yet), create it with this prompt only. T71's first prompt will be prepended when T71 lands.

## Out of Scope

- Adding `program_id` to `get_training_stats` — explicit non-goal of the Epic Brief (stats are aggregated multi-program).
- Removing L188 from `SKILL.md` entirely — Epic C does that. T72 only annotates.
- Caching the cycle→program lookup in `get_workout_history` — explicit non-goal.
- Changing the existing markdown layout or content of `get_upcoming_workouts` / `get_workout_history` beyond the `*(id: ...)*` and `*(program: ..., id: ...)*` annotations.
- Updates to `get_workout_history` that go beyond surfacing `program_id` (no other refactor "tant qu'on y est").

## Acceptance Criteria

- [ ] Calling `get_upcoming_workouts` returns markdown whose header line ends with `*(id: <full uuid>)*`
- [ ] Calling `get_workout_history` returns markdown where each session block's header line ends with `*(program: <name>, id: <full uuid>)*` for sessions that have a cycle, and OMITS the annotation cleanly for sessions where `cycle_id IS NULL`
- [ ] `formatSessionSummary` called without the `programInfo` arg produces output IDENTICAL to today (regression test passes)
- [ ] `formatSessionSummary` called with `programInfo: { id: "", name: "X" }` (empty id) does NOT inject `*(program: X, id: )*` — annotation is omitted
- [ ] `lib/format.test.ts` covers the 5 cases listed in scope (with/without programInfo, undefined, empty id, full UUID)
- [ ] `skills/gymlogic-mcp/SKILL.md` describes the new `program_id` surfacing in the two extended tools
- [ ] L188 of `skills/gymlogic-mcp/SKILL.md` carries the forward-looking Epic C annotation, with the original line preserved
- [ ] `docs/mcp-connect/example-prompts.md` contains the "Compare two programs side by side" flow including the variant that uses `get_upcoming_workouts.id`
- [ ] Manual validation in **Iris** AND **Claude Desktop**: the example prompt resolves zero-shot, and program IDs from `get_upcoming_workouts` can be successfully passed into `get_program_details`
- [ ] No existing test regresses (`npm test` green)

## References

- Epic Brief: [`docs/Epic_Brief_—_MCP_—_Read_Programs_#276.md`](./Epic_Brief_—_MCP_—_Read_Programs_#276.md) — see user stories 13, 14, 15, 16
- Tech Plan: [`docs/Tech_Plan_—_MCP_—_Read_Programs_#276.md`](./Tech_Plan_—_MCP_—_Read_Programs_#276.md) — see "formatSessionSummary" component responsibility and "Failure Mode Analysis" rows for sessions without cycle
- Sister tickets: [T70](./T70_—_list_programs_MCP_Tool.md), [T71](./T71_—_get_program_details_MCP_Tool.md)
- Existing files to extend: `file:supabase/functions/mcp/tools/getUpcomingWorkouts.ts`, `file:supabase/functions/mcp/tools/getWorkoutHistory.ts`, `file:supabase/functions/mcp/lib/format.ts`
- Existing skill doc: `file:skills/gymlogic-mcp/SKILL.md` — line 188 is the entry to annotate
