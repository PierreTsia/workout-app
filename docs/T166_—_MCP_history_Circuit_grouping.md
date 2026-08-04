# T166 — MCP history Circuit grouping

## Goal

`get_workout_history` regroupe les actuals Circuit round-major (comme la history card in-app), y compris pour Circuits créés au Builder. Story Epic 11.

## Mode

**AFK**

## Slice

select `block_exercise_id` → `sessionHistoryGrouping` Edge port → format → Deno tests

## Dependencies

None (parallel to T163).

## Scope

- Port `file:src/lib/sessionHistoryGrouping.ts` → `file:supabase/functions/mcp/lib/sessionHistoryGrouping.ts`.
- Fetch meta (`block_exercises` → `exercise_blocks`) ; orphan → solo fallback.
- Output order : Circuits before solos (match app).
- No Circuit Completion Time / PB.

## Out of Scope

- CCT/PB ; write path ; details/upcoming (T165).

## Acceptance Criteria

- [ ] Session with logged Circuit cells renders grouped round-major (not flattened by name).
- [ ] Same exercise twice in a Circuit stays distinct cells.
- [ ] Orphan `block_exercise_id` (deleted template) falls back to solo.
- [ ] Solo-only history unchanged.

## References

- Epic : `file:docs/Epic_Brief_—_MCP_&_AI_Circuits.md`
- Tech Plan : `file:docs/Tech_Plan_—_MCP_&_AI_Circuits.md`
- `file:src/lib/sessionHistoryGrouping.ts`
