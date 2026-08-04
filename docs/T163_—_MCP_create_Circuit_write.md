# T163 — MCP `create_*` Circuit write

## Goal

Un agent peut créer un programme ou une séance ad-hoc contenant un **MCP Circuit Item** via `create_program` / `create_workout_day` (dry_run puis apply). Stories Epic 1, 3–8, 21, 23–24.

## Mode

**AFK**

## Slice

`createProgramValidation` (circuit) → `blockPersistence` Edge → `daySequence` → create tools + dry_run format → Deno tests

## Dependencies

None.

## Scope

### Parse / validate

- Extend `ParsedExercise` → `ParsedDayItem` with `kind: "circuit"` in `file:supabase/functions/mcp/lib/createProgramValidation.ts`.
- Wire `type: "circuit"` ; defaults Builder ; bounds ADR 0011 ; reject solo fields + flat+`per_round`.
- `collectCandidateExerciseIds` descends into nested circuit exercises.

### Persist

- `file:supabase/functions/mcp/lib/blockPersistence.ts` — port defaults/builders ; `weight_kg`→`weight` ; flat→propagate `per_round`.
- `file:supabase/functions/mcp/lib/daySequence.ts` — wipe solos+blocks (for shared use) + insert Unified Day Sequence by array index.
- Wire `create_program` + `create_workout_day` insert paths + tool `inputSchema` oneOf.

### Preview

- `formatCircuitPreview` adaptatif (compact / expand) in `file:supabase/functions/mcp/lib/format.ts` ; dry_run `rendered` includes Circuit lines.

## Out of Scope

- `update_program` (T164), reads (T165–T166), skill prose (T167), draft AI (T168), QW (T170).

## Acceptance Criteria

- [ ] `create_program` dry_run with a flat Circuit returns adaptive rendered lines ; `dry_run: false` persists `exercise_blocks` + `block_exercises` visible in-app.
- [ ] `create_workout_day` accepts the same Circuit shape (cap 20 items ; Circuit = 1 slot).
- [ ] Reject: solo fields inside Circuit ; flat+`per_round` ; `<2` or `>8` nested exos ; `per_round.length !== rounds`.
- [ ] Solo-only payloads unchanged (existing Deno tests green).
- [ ] Nested exercise IDs are catalog-fetched (no silent skip).

## References

- Epic : `file:docs/Epic_Brief_—_MCP_&_AI_Circuits.md`
- Tech Plan : `file:docs/Tech_Plan_—_MCP_&_AI_Circuits.md`
- ADR : `file:docs/adr/0011-mcp-circuit-items-in-exercises-array.md`
