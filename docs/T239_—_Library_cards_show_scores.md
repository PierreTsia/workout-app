# T239 — Library cards show scores

## Goal

**Library Programs** cards show the four scores + one fact line, from a batched intent query. Sheet still exists. After Éditer / Builder save, cards refresh. Addresses Epic stories 3, 4, 20 (skeleton, not fake bands).

## Mode

AFK — card chrome and fetch strategy are locked.

## Slice

slim `workout_days` batch → `useProgramsIntent` → `ProgramScoreChips` + fact line → `ProgramCard` → vitest (+ invalidation on Builder mutations)

## Dependencies

T238.

## Scope

### Fetch

- `file:src/hooks/useProgramsIntent.ts` — key `["programs-intent", userId]`. `workout_days` where `program_id IN (…)`, embed `SLIM_EXERCISE_SELECT` (not `LABEL`). `toIntent` + `scoreProgram` per program.
- After fetch, `setQueryData(["program-intent", id], …)` for each id (hydrate T240).

### Invalidation

Wire `["programs-intent"]` + `["program-intent"]` into existing mutation `onSuccess` (day / exercise / block writes, `useCreateProgram`, `useArchiveProgram`, `useUpdateProgramName`, `useActivateProgram`). Missing this is a ship bug.

### UI

- `file:src/components/program/ProgramScoreChips.tsx` — 3 bands + Balance 0–100 (`empty` → hide chip, not `short`).
- Fact line: `facts.line` from the i18n contract.
- `ProgramCard`: chips + fact under the name. Loading intent → skeleton chips, not `short`.
- Register namespace `program` in `file:src/lib/i18n.ts` and `file:src/test/utils.tsx`. Copy **only** the contract keys needed here: `track.*`, `band.*`, `track.balance`, `facts.line`.

`library` activate/archive/edit keys unchanged. « Détails » still opens the sheet (T240 kills it).

### Tests

- Card with a scored fixture shows bands + fact line
- Empty program: no `short` chips
- `vi.mock("@/lib/supabase")` on any file that imports the client
- Arch or unit: select string includes `secondary_muscles` / `measurement_type` (SLIM), not LABEL-only

## Out of Scope

- `/programs/:id`, kill sheet, card `Link` (T240)
- Rubric sentences / tap example (T240 / T241)
- Profil / Home retarget (T240)
- HITL prose rewrite (T241)

## Acceptance Criteria

- [ ] Opening `/library/programs` shows chips + `N j · N séries · N circuits` on a real program
- [ ] Empty / 0-item program: skeleton or empty, never fabricated `Dans le viseur`
- [ ] Saving a Builder edit invalidates intent keys; returning to Library updates chips
- [ ] EN + FR keys used here match the Tech Plan i18n contract (`track.*`, `band.*`, `facts.line`)
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief stories 3, 4, 20
- Tech Plan: `useProgramsIntent`, ProgramCard, invalidation constraint
- i18n contract: `program` namespace
