# T713 — Program page DayCard locale

## Goal

Make `/programs/:id` show English exercise names: keep the catalog embed that
`useProgramDayCards` already fetches and resolve names in `DayCard` through
`useCatalogLabels`.

Addresses Epic Brief stories: **3** (program page), **13** (mixed program consistent), **10**
(retroactive correction).

## Mode

AFK.

## Slice

`file:src/hooks/useProgramDayCards.ts` → `file:src/lib/dayCardItems.ts` →
`src/components/library/DayCard.tsx` → golden fixture.

## Dependencies

None. Pure client change — `useCatalogLabels` / `resolveExerciseName` already exist and are
language-reactive, so this parallelizes with T710.

## Scope

### Carry the embed

- `file:src/lib/dayCardItems.ts:38-57` — add `exercise?: { name: string|null; name_en: string|null }|null`
  to `DayCardExercise` and `DayCardBlockStation`.
- `:76,96` — carry `ex.exercise` through instead of dropping it; keep `name_snapshot` as fallback.
- `file:src/hooks/useProgramDayCards.ts:35` — widen the circuit-station select from
  `exercise:exercises(measurement_type)` to `exercise:exercises(${LABEL_EXERCISE_SELECT})`.

### Render localized

- `file:src/components/library/DayCard.tsx:36,84` — title and instructions label via
  `useCatalogLabels().exerciseName({ name_snapshot, exercise })`, mirroring
  `DayOutlinePopover.tsx:69-72`.
- `ProgramDayRow.tsx` inherits via `DayItemLines` — verify it now renders localized.

## Out of Scope

- `DayOutlinePopover` (already correct).
- `ExerciseDetail` / `ExerciseById` drill-down (already fetches the catalog row).
- Any write path.

## Acceptance Criteria

- [ ] `DayCardExercise` / `DayCardBlockStation` carry the `exercise` embed.
- [ ] `useProgramDayCards` selects `name_en` for circuit stations.
- [ ] An `en` reader sees EN names on `/programs/:id`; a `fr` reader sees FR (golden fixture through `toDayCardItems`, not hand-fed names).
- [ ] A program mixing an agent-created day and a hand-added day shows one language.
- [ ] When the catalog row is absent, `name_snapshot` still renders (fallback test).

## References

- Tech Plan `file:docs/Tech_Plan_—_Locale_end-to-end_#729.md` (Component Responsibilities)
- `file:src/lib/catalogLabels.ts`, `file:src/hooks/useCatalogLabels.ts`
