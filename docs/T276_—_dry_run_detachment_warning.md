# T276 — `dry_run` detachment warning

## Goal

When a `dry_run` preview would detach a solo slot's history (the exercise is
removed or swapped), append an informative warning to `warnings[]` so the agent
can surface it before applying. No extra confirmation gate. Addresses Epic Brief
stories 5, 6.

## Dependencies

T275 (the matching module).

## Scope

### Formatter

`file:supabase/functions/mcp/lib/format.ts` — add
`formatSlotDetachmentWarning(name)`:
`Historique détaché : « {name} » est retiré ou remplacé — sa progression repart
de la prescription du template.`

### Handler

`file:supabase/functions/mcp/tools/updateProgram.ts` — for each
`days_to_update`, compare the current day's solo `exercise_id`s against the
incoming items with `detachedSoloExerciseIds`; map each detached id to its
catalog name and append the warning. The active-cycle warning stays first.

### Tests

- `format.test.ts` — the formatter string.
- Deno `updateProgram_test.ts` — a swap preview carries the warning; a
  weight-only change does not.

## Out of Scope

- Block detachment warnings (documented as a v1 limitation in ADR 0030).
- Any change to the `dry_run` response shape beyond `warnings[]` content.

## Acceptance Criteria

- [ ] A `dry_run` that swaps a movement adds one warning naming the removed
      exercise.
- [ ] A `dry_run` that only changes a weight adds no detachment warning.
- [ ] The `exercises[]` contract and the `dry_run` response shape are unchanged.
- [ ] `npm test`, `npm run lint`, `npx tsc -b` pass; Deno `*_test.ts` pass.

## References

- Epic Brief `file:docs/Epic_Brief_—_MCP_update_program_slot_identity_#666.md`
- Tech Plan `file:docs/Tech_Plan_—_MCP_update_program_slot_identity_#666.md`
