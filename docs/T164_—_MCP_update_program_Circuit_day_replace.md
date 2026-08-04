# T164 — MCP `update_program` Circuit day replace

## Goal

`update_program` remplace la **Unified Day Sequence** d'un jour (solos + Circuits) sans orphaner les **Exercise Blocks**. Story Epic 2.

## Mode

**AFK**

## Slice

`applyDayUpdate` → `daySequence` → `update_program` dry_run/apply → Deno tests

## Dependencies

T163.

## Scope

- Route day UPDATE through `daySequence` : preflight catalog → DELETE `workout_exercises` → DELETE `exercise_blocks` → INSERT interleaved.
- Dry_run markdown (`formatProgramAfterUpdate`) renders Circuits.
- Snapshot/diff types accept circuit day items where needed (`updateProgramTypes` / validation).

## Out of Scope

- Surgical add/edit Circuit-by-id ; reads echo fence (T165) ; skill (T167).

## Acceptance Criteria

- [ ] Patching a day that had a Builder Circuit with a new mixed `exercises[]` leaves **no** orphan blocks ; new Circuit/solos match payload.
- [ ] Dry_run preview shows Circuit lines before apply.
- [ ] Solo-only `update_program` paths still green.
- [ ] Preflight catalog miss aborts **before** DELETE.

## References

- Epic : `file:docs/Epic_Brief_—_MCP_&_AI_Circuits.md`
- Tech Plan : `file:docs/Tech_Plan_—_MCP_&_AI_Circuits.md` (§ day replace)
- ADR 0011
