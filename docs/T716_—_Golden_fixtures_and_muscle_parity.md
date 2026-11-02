# T716 — Golden fixtures sweep + muscle-table parity

## Goal

Make CI fail the moment any surface leaks French to an `en` caller — the invisible-failure
mode ADR 0010 named. Collects the per-surface golden fixtures into a cross-surface guard and
pins the server muscle table to `en/catalog.json`.

Addresses Epic Brief stories: **16** (guard), **2, 7, 10, 14** (cross-cutting invariants).

## Mode

AFK.

## Slice

tests spanning T710–T715 + `en/catalog.json` parity assertion.

## Dependencies

T710, T711, T712, T713, T714, T715.

## Scope

### Per-surface golden fixtures

One fixture per surface, each run through the **real transformation** (not hand-fed English
data, which is how `ProgramDayRow.test.tsx:87-115` missed the bug):

| Surface | Entry point |
|---|---|
| Decision Card | `programPatchCard` payload |
| `update_program` markdown `warnings[]` | `warningText` output |
| `get_upcoming_workouts` | `formatWorkoutDay` |
| `get_training_stats` | `formatStatsSummary` |
| `get_program_details` | `displayExerciseName` |
| `create_program` dry-run | `buildDayRenderedLines` |
| `/programs/:id` | `toDayCardItems` |
| `get_workout_history` | `formatWorkoutHistory` |

Each asserts **zero** French catalog names for an `en` caller and unchanged FR output.

### Muscle-table parity

Assert `displayLabels.muscleLabel` pairs equal `en/catalog.json.muscles` (both directions) —
the server table cannot drift from the app one.

### Cross-cutting invariants

- **FR unchanged** (story 7): a fixture asserting the `fr` rendering is byte-identical.
- **Retroactive** (stories 2, 10): a legacy French `name_snapshot` renders `en` with no migration.
- **No extra network** (story 14): the session/preview path performs no additional request.

### Negative control

Add a deliberately un-localized surface stub to prove the harness catches a leak.

## Out of Scope

- New behavior (all in T710–T715).

## Acceptance Criteria

- [ ] Every surface in the table has a golden fixture through its real transformation.
- [ ] Introducing a French leak in any covered surface fails a test.
- [ ] The muscle-table parity test passes and fails if a pair is changed on one side only.
- [ ] The FR-unchanged, retroactive, and no-extra-network assertions are present and green.
- [ ] The negative control fails when the helper is bypassed.

## References

- Tech Plan `file:docs/Tech_Plan_—_Locale_end-to-end_#729.md` (Stress-Test 5)
- `file:src/locales/catalogParity.test.ts` (pattern to extend)
