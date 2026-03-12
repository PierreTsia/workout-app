# T17 — Builder Integration

## Goal

Bring exercise instructions into the builder views: wire `ExerciseInstructionsPanel` into the `ExerciseDetailEditor` (read-only form guidance while editing exercise parameters) and build `ExerciseInfoDialog` for the `ExerciseLibraryPicker` (preview instructions before adding an exercise to a day). After this ticket, instructions are accessible from both the workout and builder contexts.

## Dependencies

- **T15** — Schema, Types & Utilities (types, hook, i18n)
- **T16** — Instruction UI Components + Workout Integration (`ExerciseInstructionsPanel`, `InstructionSection`, `YouTubeLink` must exist)

## Scope

### ExerciseDetailEditor Integration

File: `file:src/components/builder/ExerciseDetailEditor.tsx`

Changes:
- Import `ExerciseInstructionsPanel`
- Add `<ExerciseInstructionsPanel exerciseId={exercise.exercise_id} />` between the header div (emoji + name + muscle group) and the form grid div (sets/reps/weight/rest inputs)
- `exercise` is a `WorkoutExercise` found via `useWorkoutExercises(dayId)` — `exercise_id` is available on it
- The panel is read-only in this context — no interaction with the editor's form state

### ExerciseInfoDialog Component

File: `src/components/exercise/ExerciseInfoDialog.tsx`

| Prop | Type | Description |
|---|---|---|
| `exercise` | `Exercise` | Full exercise record from the library (already available in `ExerciseLibraryPicker`) |

Behavior:
- Renders a `Dialog` (from `@/components/ui/dialog`) with:
  - **Trigger:** `Info` icon button (lucide-react `Info` icon, `h-4 w-4`, `text-muted-foreground`). The button calls `e.stopPropagation()` on click to prevent `CommandItem.onSelect` from firing.
  - **Dialog content:**
    - `DialogHeader` with emoji + exercise name as `DialogTitle`
    - Exercise image (if `image_url`), using `getExerciseImageUrl`, lazy loaded, with `onError` hide
    - Instruction sections rendered inline (not inside a Collapsible — the dialog itself is the expanded state): setup, movement, breathing, common_mistakes via `InstructionSection` components
    - `YouTubeLink` (if `youtube_url`)
    - Close button via standard Dialog close behavior
- Mobile-optimized: full-width dialog content, scrollable if content exceeds viewport

### Nested Dialog Handling

This dialog opens from inside `ExerciseLibraryPicker`, which is itself a Radix `Dialog`. Key considerations:
- Radix supports nested dialogs natively — inner dialog gets its own backdrop and focus trap
- On inner dialog dismiss, focus should return to the outer dialog's `CommandInput`
- If focus return is unreliable on iOS Safari, add `onCloseAutoFocus` handler on the inner `DialogContent` to manually refocus the command input
- Test on real mobile devices (iOS Safari, Chrome Android)

### ExerciseLibraryPicker Integration

File: `file:src/components/builder/ExerciseLibraryPicker.tsx`

Changes:
- Import `ExerciseInfoDialog`
- In each `CommandItem`, restructure layout to `flex items-center justify-between`:
  - Left side: emoji + exercise name (existing)
  - Right side: `<ExerciseInfoDialog exercise={ex} />`
- The `ExerciseInfoDialog` trigger button must NOT trigger the `CommandItem.onSelect` handler — ensured by `e.stopPropagation()` on the button click

### stopPropagation Strategy

The `Info` button inside a `CommandItem` is the trickiest integration point. Radix `Command` (cmdk) uses `onSelect` on items, which fires on click. The info button must:
1. Call `e.stopPropagation()` on `onClick`
2. If that doesn't work (cmdk captures events differently), also try `onPointerDown` with `e.stopPropagation()` + `e.preventDefault()`
3. Final fallback: move the `ExerciseInfoDialog` trigger outside the `CommandItem` entirely (adjacent element)

Test this on both desktop (click) and mobile (touch) to confirm the info dialog opens without selecting the exercise.

## Out of Scope

- Building `InstructionSection`, `YouTubeLink`, or `ExerciseInstructionsPanel` — those exist from T16
- Actual exercise content (instructions, YouTube URLs, images) — T18
- Modifying builder mutations or the exercise snapshot model
- Any changes to the workout view — already done in T16

## Acceptance Criteria

- [ ] `ExerciseDetailEditor` shows `ExerciseInstructionsPanel` between the header and form grid when an exercise has instructional content
- [ ] `ExerciseDetailEditor` shows nothing extra when the exercise has no instructional content
- [ ] `ExerciseInfoDialog` opens when tapping the info icon in `ExerciseLibraryPicker` without selecting the exercise
- [ ] `ExerciseInfoDialog` shows exercise name, image (if present), instruction sections, and YouTube link (if present)
- [ ] Dismissing the info dialog returns focus to the picker's search input (no focus trap issues)
- [ ] Nested dialog behavior works on iOS Safari and Chrome Android (manual test)
- [ ] `stopPropagation` correctly prevents exercise selection on both desktop click and mobile touch
- [ ] Existing builder E2E tests (`e2e/builder-crud.spec.ts`) continue to pass

## References

- [Epic Brief — Exercise Demo & Instructions](Epic_Brief_—_Exercise_Demo_&_Instructions.md) — Scope item 4 (Builder view integration)
- [Tech Plan — Exercise Demo & Instructions](Tech_Plan_—_Exercise_Demo_&_Instructions.md) — Component Architecture, ExerciseInfoDialog responsibilities, Nested Dialog constraint, Failure Mode Analysis
