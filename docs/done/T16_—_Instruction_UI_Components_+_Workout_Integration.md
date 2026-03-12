# T16 — Instruction UI Components + Workout Integration

## Goal

Build the three core UI components for displaying exercise instructions (`InstructionSection`, `YouTubeLink`, `ExerciseInstructionsPanel`) and integrate them into the workout view's `ExerciseDetail` component. After this ticket, users can expand a "How to perform" section mid-workout to see form guidance — the primary user-facing feature of the epic.

## Dependencies

- **T15** — Schema, Types & Utilities (migration, types, `youtube.ts`, `storage.ts`, `useExerciseFromLibrary` hook, i18n namespace)

## Scope

### InstructionSection Component

File: `src/components/exercise/InstructionSection.tsx`

| Prop | Type | Description |
|---|---|---|
| `icon` | `LucideIcon` | Icon rendered next to the section title |
| `title` | `string` | Section heading (i18n key, e.g. `t("exercise:setup")`) |
| `items` | `string[]` | List of instruction steps |

Behavior:
- If `items` is empty or undefined → renders nothing (returns `null`)
- Otherwise renders: icon + bold title on one line, then a `<ul>` with each item as an `<li>`
- Styling: `text-sm text-muted-foreground` for items, `text-sm font-medium` for title
- Suggested icon mapping: `Settings2` (setup), `Activity` (movement), `Wind` (breathing), `AlertTriangle` (common mistakes)

### YouTubeLink Component

File: `src/components/exercise/YouTubeLink.tsx`

| Prop | Type | Description |
|---|---|---|
| `url` | `string` | Full YouTube URL |

Behavior:
- Calls `getYouTubeThumbnail(url)` from `file:src/lib/youtube.ts`
- If extraction fails → renders nothing
- Otherwise renders:
  - `<a href={url} target="_blank" rel="noopener noreferrer">` wrapping:
    - Thumbnail `<img>` with `loading="lazy"`, `rounded-lg`, `aspect-video`, `object-cover`
    - Semi-transparent play circle overlay (absolute positioned, centered)
  - Below: text "Watch on YouTube" (i18n `exercise:watchOnYouTube`) with `ExternalLink` icon from lucide-react
- Thumbnail `onError`: hide the thumbnail via local `useState`, show only the text link

### ExerciseInstructionsPanel Component

File: `src/components/exercise/ExerciseInstructionsPanel.tsx`

| Prop | Type | Description |
|---|---|---|
| `exerciseId` | `string` | The `exercise_id` FK from a `WorkoutExercise` |

Behavior:
- Calls `useExerciseFromLibrary(exerciseId)` to get the full `Exercise` record
- If exercise is loading or has no instructions AND no `image_url` AND no `youtube_url` → renders nothing
- Otherwise renders a `Collapsible` (from `@/components/ui/collapsible`):
  - **Trigger:** `CollapsibleTrigger` with text label (i18n `exercise:howToPerform`) + `ChevronDown` icon with `rotate-180` transition on open. Styled as a subtle, tappable row (same pattern as `SessionRow` in `file:src/components/history/SessionList.tsx`)
  - **Content:** `CollapsibleContent` containing:
    1. Exercise image (if `image_url`): `<img>` via `getExerciseImageUrl(image_url)`, `loading="lazy"`, `rounded-lg`, `aspect-video`, `object-cover`. `onError` handler hides the image.
    2. Up to four `InstructionSection` blocks from `instructions` JSONB (setup, movement, breathing, common_mistakes) — only rendered if the array has items
    3. `YouTubeLink` (if `youtube_url`)
- Local `useState<boolean>` for open/closed state

### Workout View Integration

File: `file:src/components/workout/ExerciseDetail.tsx`

Changes:
- Import `ExerciseInstructionsPanel`
- Add `<ExerciseInstructionsPanel exerciseId={exercise.exercise_id} />` between the closing `</div>` of the header block (after the `lastSession` paragraph) and `<SetsTable />`
- `exercise.exercise_id` is already available on the `WorkoutExercise` prop

### Unit Tests

| Test file | Coverage |
|---|---|
| `src/components/exercise/InstructionSection.test.tsx` | Renders title + icon + items list. Renders nothing when `items` is empty. Renders nothing when `items` is undefined. |
| `src/components/exercise/ExerciseInstructionsPanel.test.tsx` | Renders nothing when exercise has no instructions/media. Renders collapsible trigger when exercise has content. Expands on click to show instruction sections. Shows image when `image_url` is present. Hides image on simulated load error. Renders YouTube link when `youtube_url` is present. |

## Out of Scope

- Builder integration (`ExerciseDetailEditor`, `ExerciseLibraryPicker`, `ExerciseInfoDialog`) — T17
- Actual exercise content (YouTube URLs, instruction text, images) — T18
- Uploading images to Supabase Storage — T18
- English translations of instruction content (out of epic scope entirely)

## Acceptance Criteria

- [ ] `InstructionSection` renders a titled list of steps, or nothing when items are empty/undefined
- [ ] `YouTubeLink` renders a lazy-loaded thumbnail with play overlay + external link, or nothing when URL parsing fails
- [ ] `YouTubeLink` hides thumbnail on image load error and falls back to text-only link
- [ ] `ExerciseInstructionsPanel` renders nothing when the exercise has no instructional content
- [ ] `ExerciseInstructionsPanel` shows a collapsible trigger when the exercise has at least one populated field
- [ ] Expanding the collapsible reveals image, instruction sections, and YouTube link (whichever are present)
- [ ] `ExerciseDetail` in the workout view shows the panel between the header and `SetsTable`
- [ ] No layout shift or jank when expanding/collapsing (verify on mobile viewport)
- [ ] All unit tests pass (`vitest run`)
- [ ] Existing tests continue to pass with no regressions

## References

- [Epic Brief — Exercise Demo & Instructions](Epic_Brief_—_Exercise_Demo_&_Instructions.md)
- [Tech Plan — Exercise Demo & Instructions](Tech_Plan_—_Exercise_Demo_&_Instructions.md) — Component Architecture, Component Responsibilities, Integration Changes sections
