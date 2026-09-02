# T245 — Overflow menu + kill `detail`

## Goal

Demote leftover engine fields and destructive actions to `⋯`, kill `BuilderView = "detail"`, and give **BlockCard** the same overflow chrome so the canvas is no longer a CMS list with permanent trash. Stories 5, 6, 16.

## Mode

AFK — DropdownMenu → Sheet (mobile) / Dialog (desktop), leftover-fields-only, and BlockEditor drill-in unchanged are locked.

## Slice

`ExerciseOverflowMenu` → `ExerciseDetailSheet` (leftover `ExerciseDetailForm`) → drop `"detail"` on `BuilderPage` + **BlockCard** `⋯` → vitest (+ e2e edit-circuit assertion)

## Dependencies

T244 (the four inline fields must exist on the row before this ticket deletes the `detail` stack and strips them from the form).

## Scope

### Solo overflow

- `file:src/components/builder/ExerciseOverflowMenu.tsx` — shadcn `DropdownMenu` (`moreAria`). Items: `editDetails` → sheet; `remove` → existing confirm (`removeExerciseTitle`); `AdminOnly` catalog `Link` (move the pencil off the athlete row).
- Hide the always-visible trash and the trailing admin pencil on `file:src/components/builder/ExerciseRow.tsx`.
- Row tap does **not** navigate. Drop `onTap` (or make it a no-op and delete call sites). Grip still reorders (**Unified Day Sequence**, story 17).

### Leftover fields

- `file:src/components/builder/ExerciseDetailSheet.tsx` — Sheet on mobile, Dialog on desktop (same split as the picker / **BlockEditor**). Host leftover `ExerciseDetailForm` fields only: ranges, increment, `max_weight_reached`, `ExerciseInstructionsPanel`. **Do not** re-edit sets / reps / weight / rest (single source is the row).
- Duration: overflow shows duration ranges, not rep ranges (already how the form branches).
- Unmounting with a pending debounce: flush immediately (same as today’s form).
- Delete `file:src/components/builder/ExerciseDetailEditor.tsx` (or leave it as a one-line re-export only if something still imports it — prefer delete). Grep for `ExerciseDetailEditor` / `selectedExerciseId` / `view === "detail"` = 0.

### BuilderPage

- `file:src/pages/BuilderPage.tsx` — `BuilderView = "list" | "editor"` only. Drop `selectedExerciseId`. Back stack: `editor → list → from`. Keep offline gate, `SaveIndicator`, rename, Activate.
- There is no `"detail"` deep link (React state only). Safe to delete.

### BlockCard

- `file:src/components/builder/BlockCard.tsx` — Stitch mint left rail. Pencil + trash go. `⋯` → `editBlock` (existing `onEdit` → **BlockEditor**) / `remove` (existing confirm). Stations stay a preview; **Per-round Prescription** stays in **BlockEditor**.

### e2e

`file:e2e/builder-crud.spec.ts` currently asserts a visible **Edit circuit** button. After this ticket that control is a menu item. Update that assertion (`⋯` → Edit circuit). Do **not** rewrite the **Create circuit** page-button flow — that is T246. Rebase if T246 landed first.

### i18n (`builder`)

| Key | EN | FR |
|---|---|---|
| `moreAria` | More actions | Plus d'actions |
| `editDetails` | Ranges and instructions | Plages et consignes |

Reuse as-is: `editBlock`, `remove`, `removeExerciseTitle`, `removeBlockTitle`.

### Tests

- `BuilderView` type / page: no `"detail"` branch; rendering a solo does not mount `ExerciseDetailEditor`.
- Clicking the row name does not navigate; `⋯` → sheet shows ranges / instructions and **not** a second sets input.
- `⋯` → Remove still opens the existing confirm; confirming still deletes.
- **BlockCard**: no pencil / trash buttons; `⋯` → Edit circuit still opens **BlockEditor**.
- Admin catalog link lives in the menu, still `AdminOnly`.
- `vi.mock("@/lib/supabase")`.

## Out of Scope

- One Add picker / **Create circuit** death (T246)
- Maps (T243)
- Rewriting **BlockEditor** / `PerRoundGrid`
- Hevy per-set table
- Pixel-slave Sheet chrome (T247 eyeballs density)

## Acceptance Criteria

- [ ] `BuilderView` is `"list" | "editor"` only; `ExerciseDetailEditor` / `selectedExerciseId` gone
- [ ] Solo row tap does not navigate; changing leftover fields happens via `⋯` → `editDetails`
- [ ] The sheet does not duplicate the four inline fields
- [ ] Solo delete and circuit remove go through existing confirms, not a permanent trash can
- [ ] **BlockCard** `⋯` → Edit circuit still opens **BlockEditor** (per-round grid unchanged)
- [ ] Admin catalog edit is overflow-only, still `AdminOnly`
- [ ] `e2e/builder-crud.spec.ts` edit-circuit assertion updated and green for this slice
- [ ] EN + FR keys used here match the Tech Plan i18n contract
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`
- [ ] Demoable: 4×8 on the row, ranges behind `⋯`, delete behind `⋯`, circuit edit behind `⋯`, never a third stack view

## References

- Epic Brief stories 5, 6, 16, 17
- Tech Plan: `BuilderView`, Overflow, `ExerciseDetailSheet`, `BlockCard`, Prefer shadcn
- Visual floor: `file:web/stitch/builder-503/`
