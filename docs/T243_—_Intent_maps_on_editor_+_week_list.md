# T243 — Intent maps on editor + week list

## Goal

Put a prospective **Body Map** + credit chips on **DayEditor**, and the same grain as a mini map on each **DayList** card, so an athlete picks and authors a day by what it intends to do to a body. Stories 1–3, 15, 18.

## Mode

AFK — credit grain, `bodyMapFromIntent` wrap, and empty-day hide are locked in the Tech Plan.

## Slice

`toIntentDayFromDayItems` → `dayIntentToHeatmap` → `DayIntentMap` on **DayEditor** + mini `BodyMap` on **DayCard** (`useProgramIntent` days) → vitest goldens (Cindy / PPL push / empty)

## Dependencies

None.

## Scope

### Mapper (do not fork credit math)

- `file:src/lib/programScore/toIntentDayFromDayItems.ts` — `DayItem[]` + day id/label → `ProgramIntentDay`. Feed `toSolo` / `toStation` / `toCircuit` (export them from `file:src/lib/programScore/toIntent.ts` if needed). Live catalog `secondary_muscles` + `measurement_type` from the existing FULL embed on `useWorkoutExercises` / `useExerciseBlocks`; snapshot fallback. Unknown muscles dropped, same as the scorer.
- `LABEL_EXERCISE_SELECT` is the wrong embed — do not introduce a slim path here.

### Heatmap helper

- `file:src/lib/programScore/dayIntentToHeatmap.ts` — `dayIntentToHeatmap(day)` + `dayBalanceCredits`. Wrap `bodyMapFromIntent({ programId, days: [day] })` (or equivalent one-day intent). Returns `{ data, chips }`.
- `MuscleChip`: `{ muscle, credit }` from `dayBalanceCredits`, zeros omitted, sorted descending. Label via `useCatalogLabels().muscleLabel`. Value: integer if whole, else one decimal. **Not** a **Goal Track**.

### Editor

- `file:src/components/builder/DayIntentMap.tsx` — always-visible `BodyMap` `size="md"` + `BODY_MAP_INTENSITY_COLORS` + horizontal chips. Hidden when both `data` and `chips` are empty.
- Mount it as the **DayEditor** hero (day name, then map, then **Unified Day Sequence**). Derive `ProgramIntentDay` from `useDayItems` already on the editor. No extra fetch. No `useEffect` to sync the map.
- Empty day: map hidden; rewrite `noExercises` to the i18n contract (FR **tu**). The two Add buttons stay until T246.

### Week list

`useProgramIntent` today returns scores only (`ProgramIntentScore`). `useProgramsIntent` hydrates that cache with `score` and has a week-level `bodyMap`, not per-day heatmaps.

- Extend `file:src/hooks/useProgramIntent.ts` so the cached payload includes `toIntent(...).days` (`ProgramIntentDay[]`) without a second network call.
- Align `useProgramsIntent` `setQueryData([PROGRAM_INTENT_KEY, id], …)` to the same shape so Library → Builder does not flash empty minis.
- `ProgramPage` keeps reading score fields only. **Do not render scores on DayList.**
- `file:src/components/builder/DayList.tsx` **DayCard**: mini `BodyMap` `size="sm"` from `dayIntentToHeatmap(day)`. Drop the grey `exerciseCount` subtitle (it also ignored **Circuits**). Keep add day, reorder, delete-day trash + confirm.
- Seven days × two SVG models is acceptable. No virtualize.

### i18n (`builder`)

Copy contract values only:

| Key | EN | FR |
|---|---|---|
| `noExercises` | Nothing on this day yet. | Rien sur ce jour pour l'instant. |
| `newDay` | New day | Nouveau jour |

Chip labels are `muscleLabel`, not `builder` keys. Do not rewrite untouched *vous* leftovers (`offlineDescription`).

### Tests

- Goldens: Cindy-only day (station credit `1` / `0.5` once — never `rounds ×`), PPL push day, empty day (empty data + chips).
- Mapper: live `secondary_muscles` win; unknown muscle dropped.
- **DayEditor**: empty → no silhouette / no chips + new empty copy; a day with ≥1 slot shows the map.
- **DayList**: a day with a slot shows `size="sm"` map; `exerciseCount` string gone.
- Arch or unit: builder map path does not import `useAggregatedMuscles`.
- `vi.mock("@/lib/supabase")` on any file that reaches the client.

## Out of Scope

- Inline row fields (T244), overflow / kill `detail` (T245), one Add picker (T246)
- Scoring the **Builder** (no **Goal Track** bands, no **Program Balance** 0–100, no #519 banner)
- Home / Quick Workout heatmap grain (`useAggregatedMuscles`)
- DayList delete-day `⋯` (keep today’s trash)
- AI insight, clone-to-self, marketplace, Hevy per-set table

## Acceptance Criteria

- [ ] Opening a day with ≥1 slot shows a live front/back **Body Map** + credit chips without an expand-only control
- [ ] Adding / removing a slot (existing mutations) updates the editor map from `useDayItems` cache — no extra fetch
- [ ] Week list shows a mini map per day with ≥1 slot; grey “N exercises” subtitle is gone
- [ ] Cindy-only fixture: pec (or whatever the seed hits) credit is station presence, not `rounds ×` stations
- [ ] Empty day: map + chips hidden; `noExercises` matches the contract (FR **tu**)
- [ ] **Builder** still has no score chips / rubric / #519 banner
- [ ] EN + FR keys used here match the Tech Plan i18n contract
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`
- [ ] Demoable: week list → pick a day by silhouette → editor map matches that grain

## References

- Epic Brief stories 1–3, 15, 18
- Tech Plan: Day heatmap, Volume chips, Editor data, Week minis, `DayIntentMap`, Failure Mode empty day
- ADR `file:docs/adr/0021-builder-one-add-picker.md` (picker is T246; do not add a second Add here)
- Visual floor: `file:web/stitch/builder-503/`
- Sibling: scores stay on the **Program Page** (`file:docs/Tech_Plan_—_Program_Identity_+_Scoring_#504.md`)
