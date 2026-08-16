# T199 — Circuits tab drop onto the day

## Goal

From Builder **Add Exercise**, a kind **Exercises | Circuits** lists GymLogic seeds as WOD cards. Tap Cindy instantiates catalog Rx onto **this** programmed day and closes the sheet. Stories 1, 2, 5–18 (except 3–4, which are T200).

## Mode

**AFK** — surface, write path, empty/error, and toast are locked in the Tech Plan. No copy review mid-flight.

## Slice

`useBenchmarkSeeds` → `useInstantiateBenchmarkOnDay` → `CircuitSeedCard` + kind `ToggleGroup` on Add Exercise picker → DayEditor wiring → vitest

## Dependencies

None. Requires shipped #398 (`instantiateBenchmark`, Cindy seed). Unblocks T200.

## Scope

### Seeds hook — `file:src/hooks/useBenchmarkSeeds.ts`

- React Query `queryKey: ["benchmark-seeds"]`.
- `SELECT id, slug, aliases, rx, tagline_fr, tagline_en FROM benchmark_circuits WHERE owner_id IS NULL`.
- Parse with `parseCatalogPreviewRow` (`file:src/lib/previewCatalogCircuit.ts`). Drop unparsable rows.
- Enabled when the Add Exercise picker is open. **Create circuit** picker must not fetch.
- Do not bake locale into the hook. Do not return forks. Do not migrate QW `fetchCatalogPreviewRows`.

### Instantiate hook — `file:src/hooks/useInstantiateBenchmarkOnDay.ts`

- Input `{ dayId, catalog, existingMaxSortOrder }`.
- Auth → `fetchExercisesByIds` (`id, name, muscle_group, emoji`) → Map → `instantiateBenchmark` → insert `exercise_blocks` then `block_exercises` (same two-step as `useCreateBlock`).
- Invalidate `["exercise-blocks", dayId]` and `["workout-days"]`.
- Missing `exercise_id` throws **before** insert. `"Not authenticated"` if no user.
- Do **not** extend `useCreateBlock`. Do **not** mint a `workout_days` row.

### Card — `file:src/components/builder/CircuitSeedCard.tsx`

- Name = capitalized slug, `AmrapLabel` (or rounds), tagline via `isEnglish` (`tagline_en ?? tagline_fr` / inverse).
- Button/card, not a checkbox. Accessible name = seed label. Pending → disabled + spinner.
- No Info, no movement list.

### Picker — `file:src/components/builder/ExerciseLibraryPicker.tsx`

- Optional `onInstantiateSeed` (or picker-local mutation + `existingMaxSortOrder` prop). Presence of the instantiate path **gates** the kind toggle. Create circuit instance (`onCreateBlock`) has **no** toggle.
- `ToggleGroup` **Exercises | Circuits** (`file:src/components/ui/toggle-group.tsx`). Default Exercises; reset on close.
- **Circuits:** hide `ExerciseFilterPanel`; list all seeds as cards (ignore search box — **T200**); empty/error copy; kind toggle **always** visible.
- **Exercises:** current list. Do not pin cards (T200). Footer Apply CTA unchanged.
- Tap card → mutate → on success close + `onMutationStateChange("saved")`. On throw: toast + `"error"`; **sheet stays open**; no row.

### DayEditor — `file:src/components/builder/DayEditor.tsx`

- Wire only the Add Exercise picker. Pass `existingMaxSortOrder = max(dayItems.sort_order)` (same as `handleCreateBlock`).
- Do not add a third button. Do not touch **Create circuit**, `SwapExerciseSheet`, home, SideDrawer, `/library`.

### i18n — `file:src/locales/en/builder.json` + `fr/builder.json`

| Key | EN (intent) |
|---|---|
| `kindExercises` | Exercises |
| `kindCircuits` | Circuits |
| `circuitsEmpty` | No benchmark circuits yet. |
| `circuitsError` | Couldn’t load circuits. |
| `instantiateError` | Couldn’t add this circuit. |

## Out of Scope

- Search punch-through / `seedMatchesQuery` / pin-above-muscles → **T200**.
- Filtering the Circuits list by the search box → **T200**.
- Home CTA, ad-hoc day, MCP write, QW refactor, Circuit Forks in the tab, Zeus, picker Info.
- Transactional insert RPC (orphan block accepted).

## Acceptance Criteria

- [ ] Add Exercise picker shows kind **Exercises | Circuits**. Create circuit picker does not.
- [ ] Circuits (empty search) shows Cindy card: name, `AMRAP 20 min`, localized tagline — not 5-10-15 hardcoded.
- [ ] Tap → `exercise_blocks.benchmark_circuit_id` = seed id, Rx = seed JSONB, `BlockCard` in the day, sheet closed.
- [ ] `rg` in `src/` has no Cindy Rx literal used to persist a block.
- [ ] Seed fetch error / zero rows: kind toggle still visible; empty or error copy inside Circuits; Exercises kind still works.
- [ ] Instantiate throw (offline, missing `exercise_id`): toast, sheet open, no new block.
- [ ] Adding Cindy twice on the same day is allowed.
- [ ] Vitest: seeds query filters `owner_id IS NULL`; instantiate stamps FK and throws before insert if an `exercise_id` is missing; picker tests: no toggle in block mode; tap success closes; tap error stays open.

## References

- Epic Brief `file:docs/Epic_Brief_—_Meet_Cindy_#393.md` (stories 1–2, 5–18)
- Tech Plan `file:docs/Tech_Plan_—_Meet_Cindy_#393.md`
- ADR `file:docs/adr/0016-meet-cindy-builder-seed-drop.md`
- `file:src/lib/instantiateBenchmark.ts`, `file:src/hooks/useBlockMutations.ts` (`useCreateBlock`)
