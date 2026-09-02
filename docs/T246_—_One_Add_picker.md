# T246 — One Add picker

## Goal

Give the day editor exactly one primary **Add**, fold jetable **Circuit** create into **Circuits**, and make the Exercises tab add-only so Meet Cindy, catalog solos, and custom supersets share one sheet (ADR 0021). Stories 7–14.

## Mode

AFK — one instance, `kind` + `circuitMode`, add-only, and seed tap-to-drop are locked. Widget IA is in the Tech Plan (pinned **New circuit** row, not a third button).

## Slice

`NewCircuitRow` → `ExerciseLibraryPicker` internal modes (kill `onCreateBlock` as a second instance) → one **DayEditor** CTA → rewrite picker tests + `e2e/builder-crud.spec.ts`

## Dependencies

None. Parallel with T243 and T244. May land before or after T245 — rebase the e2e file if both touched it.

## Scope

### DayEditor — one verb

- `file:src/components/builder/DayEditor.tsx` — one `Add` CTA (`addExercise`, sentence case). One `ExerciseLibraryPicker`. Delete `blockPickerOpen` and the page-level **Create circuit** button.
- Empty day uses the same Add (empty copy is T243’s `noExercises`).

### Picker — one instance, internal mode

- `file:src/components/builder/ExerciseLibraryPicker.tsx` + `file:src/components/builder/ExerciseSelectionContent.tsx` — React state only: `kind: "exercises" | "circuits"`, `circuitMode: "seeds" | "create"`. Not persisted.
- Kill `onCreateBlock` as the thing that hides the kind toggle. Kind toggle **Exercises | Circuits** always visible in this picker (`kindExercises` / `kindCircuits`).
- Title: `addToDay` with the current day label (pass `label` in; do not guess).
- `file:src/components/builder/NewCircuitRow.tsx` — pinned on Circuits / seeds. Sets `circuitMode` to `"create"`. Copy: `newCircuit` + `newCircuitHint`. No **WOD** on this row.

### Exercises tab (add-only)

- Multi-select catalog → footer `addSelectedCount` (**Add {{count}}**). Footer disabled at 0.
- Already-on-day = `alreadyInDay` badge, not selectable, **not** a delete. Uncheck-to-remove is gone. `applyChanges` is no longer the Exercises footer.
- Constraint is **Exercises tab only**. Search punch-through from **Exercises** (`cindy` / seed aliases pin the WOD card) stays.

### Circuits tab

- **Seeds:** tap a GymLogic seed → existing `instantiateBenchmark` on this programmed day → close. No checkboxes on Cindy. Failure: existing `instantiateError`; picker stays open.
- **Create:** `pickerBack` returns to seeds. Catalog multi-select; `createBlockCta` (≥2, disabled below); existing `useCreateBlock` (two-step insert, existing risk). Then close. Already-on-day does **not** block station picks (a solo can become a station).

### Tests (behavior break)

`file:src/components/builder/ExerciseLibraryPicker.test.tsx` today asserts uncheck + **Apply changes** deletes, and that Create-circuit mode hides the kind toggle. Rewrite those.

Must cover:

- One picker; kind toggle visible
- Exercises: already-on-day not selectable; Apply/uncheck-to-delete gone; footer **Add N**
- Circuits / seeds: seed tap instantiates and closes; **New circuit** row present
- Circuits / create: ≥2 enables `createBlockCta`; already-on-day still pickable as a station
- Punch-through still pins Cindy from the Exercises search
- Tests that fetched no seeds “when Create circuit picker is open” must die with that mode

### e2e

`file:e2e/builder-crud.spec.ts` clicks a page-level **Create circuit** button. Rewrite: **Add** → **Circuits** → **New circuit** → pick ≥2 → `createBlockCta`. If T245 already moved **Edit circuit** into `⋯`, keep that assertion; do not revert it.

### i18n (`builder`)

| Key | EN | FR |
|---|---|---|
| `addToDay` | Add to {{label}} | Ajouter à {{label}} |
| `newCircuit` | New circuit | Nouveau circuit |
| `newCircuitHint` | Pick at least two exercises. | Choisis au moins deux exercices. |
| `pickerBack` | Back | Retour |
| `alreadyInDay` | On day | Sur ce jour |
| `addSelectedCount_one` | Add {{count}} | Ajouter {{count}} |
| `addSelectedCount_other` | Add {{count}} | Ajouter {{count}} |
| `addExercise` | Add exercise | Ajouter un exercice |

Reuse as-is: `kindExercises`, `kindCircuits`, `createBlockCta_*`, `instantiateError`. `createBlock` may remain unused — do not invent a page button to keep it alive. FR **tu** on new strings (`newCircuitHint`).

### Copy law

Values say **Circuit**, never “block”. Never **Exercise Slot** / **Template Prescription**. No `New block` / `Nouveau bloc`.

## Out of Scope

- **Circuit Catalog** encyclopedia drop (#483)
- Maps (T243), inline row / overflow (T244 / T245)
- Transactional `useCreateBlock` (existing two-step risk stays)
- A second picker instance “just for create”
- Home / session add-exercise sheets

## Acceptance Criteria

- [ ] **DayEditor** exposes exactly one primary add CTA
- [ ] **New circuit** lives inside **Circuits**; there is no page-level **Create circuit**
- [ ] Seed tap still instantiates on the current day and closes the sheet
- [ ] Exercises tab cannot delete by unchecking; already-on-day is badged and not selectable
- [ ] Circuits / create can pick a movement that is already a solo
- [ ] Search punch-through from Exercises still pins the WOD card
- [ ] Picker title names the day (`addToDay`)
- [ ] `e2e/builder-crud.spec.ts` green without a page-level Create circuit button
- [ ] EN + FR keys used here match the Tech Plan i18n contract; 0 “block” / slot / prescription leaks in new strings
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`
- [ ] Demoable: one Add → drop two solos, drop Cindy, create a jetable Circuit, never a second outline button

## References

- Epic Brief stories 7–14
- Tech Plan: One picker, Jetable create, Picker add, `ExerciseLibraryPicker`, `NewCircuitRow`, Add-only behavior break
- ADR `file:docs/adr/0021-builder-one-add-picker.md`
- Visual floor: `file:web/stitch/builder-503/`
