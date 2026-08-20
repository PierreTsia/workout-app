# T170 — Quick Workout Circuit E2E

## Goal

**Quick Workout AI** peut générer, prévisualiser et committer un Circuit via `create_workout_day`. Stories Epic 19–20. Phase 2 du Tech Plan.

## Mode

**AFK**

## Slice

QW schema/`validateAndRepair` → PreviewStep → commit → `create_workout_day` → tests

## Dependencies

T163.

## Scope

- Replace flat `exerciseIds[]` contract with day-items (solo prescriptions + Circuits) end-to-end.
- PreviewStep renders Circuit cards distinctly.
- `quickWorkout.ts` / `commit-quick-workout` map to MCP Circuit Items.
- Prompts : when to emit Circuits (conditioning / explicit).

## Out of Scope

- Chat-style QW ; Benchmark Circuits ; Program draft (T168).

## Acceptance Criteria

- [ ] Generate path can return ≥1 Circuit ; PreviewStep shows it.
- [ ] Commit persists Circuit on ad-hoc day (`program_id` null) ; active program untouched.
- [ ] Solo-only QW path non-regression.
- [ ] Deno/Vitest cover validate/repair + mapping ; component tests for Circuit preview card.

## References

- Epic : `file:docs/Epic_Brief_—_MCP_&_AI_Circuits.md`
- Tech Plan Phase 2
- ADR 0011
