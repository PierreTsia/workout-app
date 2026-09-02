# T244 — Inline solo 4-fields

## Goal

Make changing sets / reps-or-hold / weight / rest a one-tap job on the solo row, without navigating to `BuilderView = "detail"`. Story 4 (save-error story 21 uses the existing indicator).

## Mode

AFK — fields, debounce, duration swap, and rest-as-seconds are locked. Dual-write with `ExerciseDetailForm` is an explicit interim until T245.

## Slice

`ExerciseRow` compact `Input`s → debounced `useUpdateExercise` (500ms, flush on unmount) → vitest

## Dependencies

None. Parallel with T243 and T246.

## Scope

### Row

- `file:src/components/builder/ExerciseRow.tsx` — grip + thumb + name stay. Replace the grey `muscle · sets×reps @ kg · rest` subtitle with four compact shadcn `Input`s: sets, reps-or-hold, weight (display unit via `useWeightUnit`), rest (seconds stored, same as today). Stitch’s `2:00` is visual floor, **not** a `mm:ss` parser.
- Layout: below `md`, two-line (line 1: grip + thumb + name + existing trailing controls; line 2: the four Inputs). From `md` up, Stitch 7-column grid.
- Duration slots (`measurement_type === "duration"`): reps column becomes hold (`holdColumn`). Overflow still owns duration *ranges* (T245).
- Row tap **still** calls `onTap` → `detail`. Trash **still** visible. **Admin pencil stays** (`AdminOnly` catalog `Link`). T245 moves both.
- Row tap must **not** fire when focusing / typing in an Input (`stopPropagation` on the field row).

### Save path

- Existing `useUpdateExercise` only. Copy the 500ms `flush` from `file:src/components/builder/ExerciseDetailForm.tsx`. Flush on unmount if a timer is pending.
- Do **not** write `template_updated_at` from the client. Rest-only patches send `rest_seconds` (and `id` / `dayId`), nothing else invented.
- Mutation error → existing `onMutationStateChange("error")` → **Syncing failed**. Local input keeps the typed value. Wire the callback from **DayEditor** (same as today for other writes).
- Do **not** remove debounce or the four fields from `ExerciseDetailForm`. That is T245. Do not assert both write paths in the same test.

### i18n (`builder`)

| Key | EN | FR |
|---|---|---|
| `restColumn` | Rest | Repos |
| `holdColumn` | Hold | Tenue |

Reuse as-is: `sets`, `reps`. Full `restSeconds` / `targetDurationSeconds` stay for the sheet.

### Tests

- Changing sets (or reps / weight / rest) calls `useUpdateExercise` and does **not** require `onTap`.
- Duration fixture: hold input present, reps column absent.
- Rest patch payload has no `template_updated_at`.
- Unmount with a pending debounce flushes once.
- `onTap` still works when clicking the name/thumb (interim).
- Pencil and trash still in the document.
- `vi.mock("@/lib/supabase")`.

## Out of Scope

- `ExerciseOverflowMenu` / `ExerciseDetailSheet` / killing `"detail"` (T245)
- Hiding trash or the admin pencil (T245)
- **BlockCard** chrome (T245)
- Picker / one Add (T246)
- Maps (T243)
- Hevy per-set table (ADR 0006)

## Acceptance Criteria

- [ ] Editing sets / reps-or-hold / weight / rest on a solo does not set `BuilderView` to `"detail"`
- [ ] Duration exercise: the second field is Hold (seconds), not Reps
- [ ] Rest is stored as seconds; client rest patch does not include `template_updated_at`
- [ ] 500ms debounce; pending timer flushes on unmount
- [ ] Failed mutation still surfaces `syncFailed`; typed value stays in the input
- [ ] Tap-to-`detail`, trash, and admin pencil still work (interim; T245 removes them)
- [ ] EN + FR keys used here match the Tech Plan i18n contract
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`
- [ ] Demoable: change 4×8 on the row, see **Saved** / **Syncing failed**, never leave the editor

## References

- Epic Brief stories 4, 21
- Tech Plan: Inline save, Solo row layout, `ExerciseRow`, `rest_seconds` constraint, Duration exercise failure mode
- Visual floor: `file:web/stitch/builder-503/`
