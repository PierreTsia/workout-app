# T70 — list_programs MCP Tool

## Goal

Ship the `list_programs` MCP tool end-to-end so an AI assistant connected to GymLogic can browse all of a user's training programs in one round-trip — including draft programs without an active cycle. Delivers user stories **1–6** of the Epic Brief: browse & discover with `is_active`, `has_active_cycle`, `day_count`, `created_at`, optional `include_archived`, and clean empty-state messaging.

After this ticket, an agent can run *"hey Iris, list mes programmes"* and get a useful answer that distinguishes "current and running" from "current but paused" from "draft" from "archived".

## Mode

**AFK** — no human decision required mid-flight. The spike is engineering exploration, not HITL.

## Slice (layers traversed)

Spike (Supabase nested filter syntax) → Postgres query (`programs` + nested `workout_days(count)` + `cycles(id)`) → handler (`listPrograms.ts`) → pure formatter (`formatProgramListEntry`) → tool registry → Vitest suite → SKILL.md update (new tool entry + Discovery flow scaffold).

## Dependencies

None. T70 has no upstream blockers and is a parallelization candidate alongside T72 (which touches different files).

## Scope

### Spike — Supabase nested filter syntax

Before writing the handler, validate the exact Supabase JS API call that returns `programs` joined with `workout_days(count)` and `cycles(id)` filtered to active-only. The plausible candidates are `cycles!inner(id)` with a `.filter("cycles.finished_at", "is", null)`, or `cycles(id)` with `.is("cycles.finished_at", null)`. Document the working syntax with a short comment in the handler at the `select()` call.

| Item | Detail |
|---|---|
| Time budget | ≤30 min |
| Output | A 2-3 line note in the PR description: "validated syntax X works because Y" |
| Plan B | If neither works cleanly, fall back to 2 separate queries (programs + active-cycle existence per program), join in JS. Document why in the same PR note. |

### Handler — `supabase/functions/mcp/tools/listPrograms.ts`

| Item | Detail |
|---|---|
| Input args | `include_archived?: boolean` (default `false`). No other arguments — no pagination, no name filter |
| Auth gate | Same pattern as the 6 existing tools: returns the standard `"Authentication required — please provide a valid Bearer token."` error if `supabase` is null |
| Default filter | `.is("archived_at", null)` when `!include_archived` |
| Cycle filter | The active-cycle filter on the join (exact syntax locked by the spike) |
| Sort | `.order("is_active", { ascending: false }).order("created_at", { ascending: false })` |
| Mapping | `day_count: row.workout_days?.[0]?.count ?? 0`, `has_active_cycle: (row.cycles ?? []).length > 0` |
| Empty result | Returns success with text `"Aucun programme. Crée-en un dans le builder pour commencer."` |
| Error path | `isError: true` with `Error fetching programs: <supabase message>` (consistent with existing tools) |

### Formatter — `formatProgramListEntry` in `lib/format.ts`

Pure function. Signature:

```ts
formatProgramListEntry(entry: {
  id: string
  name: string
  is_active: boolean
  day_count: number
  created_at: string
  has_active_cycle: boolean
  archived_at: string | null
}): string
```

Output format (one markdown line per program):

```
**Mai 2026 v2** *(id: a3f0c4e5-1234-5678-9abc-def012345678)* — 6 days, created 2026-05-01 (active, cycle in progress)
```

Suffix logic:
- `archived_at` not null → `(archived)` (overrides everything else)
- `is_active && has_active_cycle` → `(active, cycle in progress)`
- `is_active && !has_active_cycle` → `(active)`
- otherwise → `(draft)`

### Vitest suite — `lib/format.test.ts` (new file)

Create `supabase/functions/mcp/lib/format.test.ts` with a `describe("formatProgramListEntry")` block. Cases:

- Active program with active cycle
- Active program without active cycle (paused)
- Draft program (`is_active = false`, `has_active_cycle = false`)
- Archived program (precedes other flags in suffix)
- Program with `day_count = 0` (renders `0 days`, no crash)
- Program with full UUID rendered exactly (regex match `/^[0-9a-f]{8}-...{12}$/i`)

### Registry plug — `tools/registry.ts`

Import `listPrograms` from `./listPrograms.ts` and append to the `tools` array. No other changes.

### Skill doc update — `skills/gymlogic-mcp/SKILL.md`

| Item | Detail |
|---|---|
| Add tool to roster | Insert `list_programs` row in the existing tool table, with the same description style as the others |
| Create "Discovery flow" section | Scaffold: `list_programs → (T71 will add: get_program_details) → (Epic C: update_program)`. Leave the placeholder for T71 to fill |
| Tool description (verbatim, used in the MCP `inputSchema.description`) | *"List the user's training programs (with or without active cycle). Returns id, name, is_active, day_count, created_at, has_active_cycle. Use to browse before drilling into a specific program with get_program_details. Excludes archived programs by default — pass include_archived: true to see them."* |

## Out of Scope

- `lib/uuid.ts` extraction — not used by `list_programs` (no UUID input). Owned by T71.
- `get_program_details` and `formatProgramDetails` — owned by T71.
- `program_id` surfacing in `get_upcoming_workouts` / `get_workout_history` — owned by T72.
- `docs/mcp-connect/example-prompts.md` — owned by T71 (first prompt) and T72 (second prompt).
- L188 annotation in `SKILL.md` — owned by T72.
- Pagination, name filter, or any other arg beyond `include_archived` — explicit non-goal of the Epic Brief.
- Cache layer — explicit non-goal of the Epic Brief.

## Acceptance Criteria

- [ ] Spike outcome documented in PR description (working Supabase nested filter syntax + 1-line rationale, OR Plan B chosen with justification)
- [ ] Calling `list_programs` from Iris on an account with ≥2 non-archived programs returns markdown listing them, with correct `is_active`, `has_active_cycle`, `day_count`, and creation date per entry
- [ ] Calling `list_programs` with `include_archived: true` exposes archived programs with the `(archived)` suffix
- [ ] Calling `list_programs` on an account with 0 programs returns the standard "Aucun programme" message (not an error)
- [ ] Every program entry in the markdown response carries a full UUID matching `/[0-9a-f-]{36}/i` in `*(id: ...)*` italic syntax
- [ ] `lib/format.test.ts` exists with a `formatProgramListEntry` describe block, all cases listed in scope passing, run via `npm test`
- [ ] `skills/gymlogic-mcp/SKILL.md` has the `list_programs` tool documented and a "Discovery flow" section scaffolded with a placeholder for T71
- [ ] No existing test in the repo regresses (`npm test` green)

## References

- Epic Brief: [`docs/Epic_Brief_—_MCP_—_Read_Programs_#276.md`](./Epic_Brief_—_MCP_—_Read_Programs_#276.md)
- Tech Plan: [`docs/Tech_Plan_—_MCP_—_Read_Programs_#276.md`](./Tech_Plan_—_MCP_—_Read_Programs_#276.md) — see "Spike before handler dev" key decision and "Critical Constraints" on the nested aggregate quirk
- GitHub issue: [#276 — MCP: Read all programs without cycle + Edit existing programs](https://github.com/PierreTsia/workout-app/issues/276)
- Existing tool to mirror conventions: `file:supabase/functions/mcp/tools/getUpcomingWorkouts.ts`
- Existing format helper: `file:supabase/functions/mcp/lib/format.ts`
- Existing registry pattern: `file:supabase/functions/mcp/tools/registry.ts`
