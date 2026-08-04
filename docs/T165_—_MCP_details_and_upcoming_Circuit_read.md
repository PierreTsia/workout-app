# T165 — MCP details + upcoming Circuit read

## Goal

`get_program_details` et `get_upcoming_workouts` exposent les Circuits (interleaved) ; details inclut un fence JSON echo-ready pour `update_program`. Stories Epic 9–10.

## Mode

**AFK**

## Slice

Supabase select blocks → format (reuse `formatCircuitPreview`) + JSON fence → tool handlers → Deno tests

## Dependencies

T163 (format Circuit helpers).

## Scope

- Select `exercise_blocks(..., block_exercises(..., exercises(name, name_en)))` ; merge with solos by `sort_order`.
- Markdown human + ` ```json ` block = patch-shaped `days[].exercises` (UUID | solo object | circuit).
- Upcoming day formatter includes Circuits.

## Out of Scope

- History (T166) ; skill prose (T167) ; CCT/PB.

## Acceptance Criteria

- [ ] Program with Builder Circuit : details shows Circuit interleaved ; never omits blocks.
- [ ] JSON fence round-trips into `update_program` dry_run without drift (incl. `per_round` when non-flat).
- [ ] Upcoming lists Circuits for next days.
- [ ] Solo-only programs unchanged.

## References

- Epic : `file:docs/Epic_Brief_—_MCP_&_AI_Circuits.md`
- Tech Plan : `file:docs/Tech_Plan_—_MCP_&_AI_Circuits.md` (§ echo-ready)
