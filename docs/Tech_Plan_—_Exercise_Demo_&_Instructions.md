# Tech Plan — Exercise Demo & Instructions

## Architectural Approach

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data model strategy | Extend `exercises` table with 3 nullable columns (no new tables) | Exercises are the natural home for instructional content; avoids JOIN overhead and keeps queries simple |
| Instruction content source | Read from live `exercises` table, NOT snapshotted on `workout_exercises` | Instructions are reference material, not session-specific data. Updates propagate immediately to all users. |
| Exercise lookup in workout view | Reuse `useExerciseLibrary` TanStack Query + lookup by `exercise_id` | Shared query key — if cache is warm (builder visited), instant lookup. If cold (workout-only session), triggers a single fetch on first panel mount. No custom endpoint needed. |
| Expandable UI primitive | Radix Collapsible (`@/components/ui/collapsible`) | Already installed, already patterned in `file:src/components/history/SessionList.tsx` — zero new dependencies |
| Collapsible position | Between header/badge and `SetsTable` | Users should see form guidance before logging sets |
| YouTube integration | Thumbnail derived from URL + external link (no iframe) | Free thumbnails via `img.youtube.com`, no API key, no embed performance hit on mobile |
| Image hosting | Supabase Storage public bucket (`exercise-media`) via SQL migration | Decoupled from app deploys, CDN-backed, updatable without redeploy. Bucket created via `storage.buckets` for version-controlled reproducibility. |
| Image URL format | Relative object path in DB (e.g. `bench-press.gif`), full URL built at runtime from `VITE_SUPABASE_URL` | Keeps seed data portable across environments |
| Image loading | Native `<img loading="lazy">` | Zero-dependency, supported by all target browsers (iOS 15.4+, Android 9+) |
| Builder picker info preview | Dialog (not Popover) | Mobile-first: Dialog gives a clean full-screen experience on touch devices. Avoids focus-trap conflicts with the Command component inside the picker. |
| i18n strategy | New `exercise` namespace for UI labels; instruction content stored in DB in French | Keeps UI labels translatable while avoiding the complexity of i18n for DB content |

### Critical Constraints

**Snapshot model boundary.** `workout_exercises` snapshots name, muscle group, and emoji from the exercise library at creation time (`file:src/hooks/useBuilderMutations.ts`). This pattern is intentionally NOT extended to instructions/media — these fields are always read from the live `exercises` table. This means `ExerciseDetail` (which receives a `WorkoutExercise`) must perform a secondary lookup into the exercise library cache to render instructions.

**TanStack Query fetch lifecycle.** `useExerciseFromLibrary(exerciseId)` wraps `useExerciseLibrary()`, which subscribes to the `["exercise-library"]` TanStack Query. Crucially, **`WorkoutPage` does not call `useExerciseLibrary` anywhere** — it uses `useWorkoutExercises` instead. The only current caller is `ExerciseLibraryPicker` (builder). This means the first time `ExerciseInstructionsPanel` mounts on the workout page, it will trigger the exercise library fetch (TanStack Query fires the query on first subscription). There is a brief loading window while the fetch completes. During this window, the panel renders nothing — no skeleton, no spinner — because instructions are supplementary content. Once data arrives, the panel appears. Subsequent renders use the cached result. No duplicate Supabase calls occur if multiple `ExerciseInstructionsPanel` instances mount simultaneously (TanStack Query deduplicates by query key).

**First Supabase Storage usage.** The current codebase has zero Supabase Storage usage (`file:src/lib/supabase.ts`). This epic introduces the first storage bucket. The bucket is created via SQL migration on `storage.buckets` — supported in Supabase-managed environments. If issues arise in self-hosted setups, fall back to Supabase CLI.

**`useBootstrapProgram` compatibility.** `file:src/hooks/useBootstrapProgram.ts` inserts exercises with only `name`, `muscle_group`, `emoji`, `is_system`. The new nullable columns (`youtube_url`, `instructions`, `image_url`) remain `null` for bootstrap-inserted exercises. No changes needed — these exercises will simply show no instructions until seed data is updated. Existing `select("*")` calls in bootstrap will return the new columns as `null`, which is handled by the nullable TypeScript types.

**Nested Dialog in builder picker.** `ExerciseInfoDialog` opens from inside `ExerciseLibraryPicker`, which is itself a Radix `Dialog`. Radix UI supports nested dialogs natively — the inner dialog's backdrop and focus trap are scoped correctly. However, this must be tested on mobile (iOS Safari in particular) to confirm that dismissing the inner dialog returns focus to the outer dialog's command input without jank.

---

## Data Model

### Schema Changes

```mermaid
classDiagram
    class exercises {
        uuid id PK
        text name
        text muscle_group
        text emoji
        boolean is_system
        timestamptz created_at
        text youtube_url NEW
        jsonb instructions NEW
        text image_url NEW
    }

    class ExerciseInstructions_JSONB {
        string_array setup
        string_array movement
        string_array breathing
        string_array common_mistakes
    }

    exercises --> ExerciseInstructions_JSONB : "instructions column shape"

    class StorageBucket_exercise_media {
        text bucket_id
        text object_path
        boolean public
    }

    exercises ..> StorageBucket_exercise_media : "image_url references object_path"
```

### Migration SQL

File: `supabase/migrations/YYYYMMDD_add_exercise_instructions.sql`

```sql
-- Add instructional content columns to exercises
ALTER TABLE exercises ADD COLUMN youtube_url text;
ALTER TABLE exercises ADD COLUMN instructions jsonb;
ALTER TABLE exercises ADD COLUMN image_url text;

-- Create Supabase Storage bucket for exercise media
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-media', 'exercise-media', true);

-- Allow public read access to exercise media
CREATE POLICY "Public read access on exercise-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-media');
```

### TypeScript Types

File: `file:src/types/database.ts`

```typescript
export interface ExerciseInstructions {
  setup: string[]
  movement: string[]
  breathing: string[]
  common_mistakes: string[]
}

export interface Exercise {
  id: string
  name: string
  muscle_group: string
  emoji: string
  is_system: boolean
  created_at: string
  youtube_url: string | null
  instructions: ExerciseInstructions | null
  image_url: string | null
}
```

### Table Notes

**`exercises.instructions`** — JSONB with four string-array keys. Arrays (not single strings) allow multi-step instructions per section (e.g., 3 setup steps). All sections are optional at the application level — the UI hides any section with no content. The JSONB column is unvalidated at the DB level; the TypeScript `ExerciseInstructions` type enforces shape at the application boundary.

**`exercises.image_url`** — Stores the relative object path within the `exercise-media` Supabase Storage bucket (e.g., `bench-press.gif`). A utility function builds the full public URL: `{VITE_SUPABASE_URL}/storage/v1/object/public/exercise-media/{image_url}`. Portable across environments.

**`exercises.youtube_url`** — Full YouTube URL. The app extracts the video ID at render time to build a thumbnail URL via `https://img.youtube.com/vi/{VIDEO_ID}/mqdefault.jpg`. Supports `youtube.com/watch?v=`, `youtu.be/`, and `youtube.com/shorts/` formats.

---

## Component Architecture

### Layer Overview

```mermaid
graph TD
    WorkoutPage --> ExerciseDetail
    ExerciseDetail --> ExerciseInstructionsPanel["ExerciseInstructionsPanel (new)"]
    ExerciseDetail --> SetsTable
    ExerciseInstructionsPanel --> InstructionSection["InstructionSection (new)"]
    ExerciseInstructionsPanel --> YouTubeLink["YouTubeLink (new)"]

    BuilderPage --> ExerciseDetailEditor
    ExerciseDetailEditor --> ExerciseInstructionsPanel

    BuilderPage --> ExerciseLibraryPicker
    ExerciseLibraryPicker --> ExerciseInfoDialog["ExerciseInfoDialog (new)"]
    ExerciseInfoDialog --> InstructionSection
    ExerciseInfoDialog --> YouTubeLink
```

### New Files & Responsibilities

| File | Purpose |
|---|---|
| `src/components/exercise/ExerciseInstructionsPanel.tsx` | Collapsible "How to perform" section. Accepts `exerciseId`, looks up exercise from library cache via `useExerciseFromLibrary`, renders image + instruction sections + YouTube link. Reused in workout and builder detail views. |
| `src/components/exercise/InstructionSection.tsx` | Renders a single named instruction section: icon + title + bulleted list of steps. Accepts `title`, `items`, `icon`. Renders nothing if `items` is empty. |
| `src/components/exercise/YouTubeLink.tsx` | Renders YouTube thumbnail (lazy loaded) + styled external link ("Watch on YouTube"). Accepts `url`. Extracts video ID internally via `getYouTubeThumbnail`. |
| `src/components/exercise/ExerciseInfoDialog.tsx` | Dialog triggered by an info icon button in `ExerciseLibraryPicker`. Shows a compact read-only view of instructions + image + YouTube link for an exercise before adding it. Mobile-optimized full-width dialog. |
| `src/lib/youtube.ts` | `extractVideoId(url)` — parses YouTube URL formats and returns the video ID. `getYouTubeThumbnail(url)` — returns the `mqdefault.jpg` thumbnail URL. |
| `src/lib/storage.ts` | `getExerciseImageUrl(imagePath)` — builds the full public Supabase Storage URL from a relative path. |
| `src/hooks/useExerciseFromLibrary.ts` | `useExerciseFromLibrary(exerciseId)` — wraps `useExerciseLibrary()` and returns the matching `Exercise` by ID. Uses TanStack Query cache if warm; triggers fetch if cold (no duplicate calls thanks to query deduplication). |
| `supabase/migrations/YYYYMMDD_add_exercise_instructions.sql` | ALTER TABLE + storage bucket creation + public read policy. |
| `src/locales/en/exercise.json` | i18n keys: `howToPerform`, `setup`, `movement`, `breathing`, `commonMistakes`, `watchOnYouTube`. |
| `src/locales/fr/exercise.json` | French translations of the above. |

### Component Responsibilities

**`ExerciseInstructionsPanel`**
- Accepts `exerciseId: string` prop
- Calls `useExerciseFromLibrary(exerciseId)` to get the full `Exercise` record from TanStack Query cache
- If exercise has no instructions AND no image AND no youtube_url → renders nothing (graceful absence)
- Otherwise renders a `Collapsible` with:
  - **Trigger:** text label (i18n `exercise:howToPerform`) + `ChevronDown` icon with `rotate-180` transition on open (same pattern as `SessionRow` in `file:src/components/history/SessionList.tsx`)
  - **Content:** exercise image (if `image_url`, via `getExerciseImageUrl`), up to four `InstructionSection` blocks (if `instructions`), `YouTubeLink` (if `youtube_url`)
- Local `useState<boolean>` for open/closed state

**`InstructionSection`**
- Pure presentational component
- Accepts `icon: LucideIcon`, `title: string`, `items: string[]`
- Renders: icon + bold title on one line, then `<ul>` with each item as an `<li>`
- If `items` is empty or undefined → renders nothing
- Suggested icons: `Settings2` (setup), `Activity` (movement), `Wind` (breathing), `AlertTriangle` (common mistakes)

**`YouTubeLink`**
- Accepts `url: string`
- Calls `getYouTubeThumbnail(url)` to derive thumbnail URL
- If video ID extraction fails → renders nothing
- Otherwise renders: `<a>` wrapping a thumbnail `<img>` (lazy loaded, rounded-lg, aspect-video, relative positioned) with a semi-transparent play circle overlay, plus text "Watch on YouTube" with `ExternalLink` icon below
- Link opens in new tab (`target="_blank" rel="noopener noreferrer"`)

**`ExerciseInfoDialog`**
- Accepts `exercise: Exercise`
- Renders a `Dialog` with trigger: `Info` icon button (`e.stopPropagation()` to prevent `CommandItem.onSelect`)
- Dialog content: exercise emoji + name as title, then image (if any), instruction sections (compact, no collapsible), YouTube link (if any)
- Close button in dialog header

**`useExerciseFromLibrary`**
- Calls `useExerciseLibrary()` (TanStack Query, key: `["exercise-library"]`)
- Returns `{ data: exercises?.find(e => e.id === exerciseId), isLoading }`
- If the cache is warm, this is a pure in-memory lookup with no Supabase call
- If the cache is cold (e.g., first workout page load where the library was never fetched), subscribing to the query triggers the fetch. TanStack Query deduplicates — multiple panels mounting simultaneously produce only one network request.

### Integration Changes to Existing Files

**`file:src/components/workout/ExerciseDetail.tsx`**
- Import `ExerciseInstructionsPanel`
- Add `<ExerciseInstructionsPanel exerciseId={exercise.exercise_id} />` between the `lastSession` paragraph and `<SetsTable />`

**`file:src/components/builder/ExerciseDetailEditor.tsx`**
- Import `ExerciseInstructionsPanel`
- Add `<ExerciseInstructionsPanel exerciseId={exercise.exercise_id} />` between the header div and the form grid div
- `exercise` is a `WorkoutExercise` which has `exercise_id`

**`file:src/components/builder/ExerciseLibraryPicker.tsx`**
- Import `ExerciseInfoDialog`
- In each `CommandItem`, add `<ExerciseInfoDialog exercise={ex} />` next to the exercise name
- Layout: `flex items-center justify-between` in the `CommandItem`, with emoji + name on the left and info button on the right

**`file:src/types/database.ts`**
- Add `ExerciseInstructions` interface
- Add `youtube_url`, `instructions`, `image_url` to `Exercise` interface

**`file:src/lib/i18n.ts`**
- Add `exercise` to the `ns` array
- Add resource imports for `en/exercise.json` and `fr/exercise.json`

**`file:supabase/seed.sql`**
- Update existing `INSERT INTO exercises` to include `youtube_url`, `instructions`, `image_url` columns for all 24 exercises

### Failure Mode Analysis

| Failure | Behavior |
|---|---|
| Exercise library cache is cold (first workout page load) | `useExerciseFromLibrary` subscribes to `useExerciseLibrary`, triggering the fetch. `isLoading` is true briefly; panel renders nothing. Once data arrives (typically <500ms), panel appears with instructions. No duplicate fetch if multiple panels mount simultaneously. |
| YouTube URL is malformed or unsupported format | `extractVideoId` returns `null`; `YouTubeLink` renders nothing. No broken image, no error. |
| YouTube video has been deleted | Thumbnail still loads (YouTube serves a generic placeholder); external link leads to YouTube's "Video unavailable" page. Acceptable degradation. |
| Supabase Storage image fails to load (404, network error) | `<img>` `onError` handler sets local state to hide the image element. Instruction text and YouTube link remain visible. |
| `instructions` JSONB has missing keys or unexpected shape | `InstructionSection` only renders if the specific array has items. Unknown keys are silently ignored. Partial instructions display correctly. |
| User has slow connection (gym wifi) | Images use `loading="lazy"` — they load only when the collapsible is opened and scrolled into view. YouTube thumbnail is ~15KB. No auto-play, no iframe, no video preload. |
| Supabase Storage bucket doesn't exist (migration not run) | `image_url` resolves to a 404. `onError` handler hides the image. Text instructions and YouTube link still work. |
| `stopPropagation` on info icon fails in CommandItem | Exercise gets selected when user tries to view info. Mitigation: test on real devices; fallback is to use `onPointerDown` instead of `onClick` for the stop. |
| Nested Dialog (info inside picker) dismissed on iOS Safari | Inner dialog dismiss may not return focus cleanly to outer dialog's Command input. Mitigation: manual testing on iOS Safari; if broken, add `onCloseAutoFocus` handler on inner dialog to refocus Command input. |
| `useBootstrapProgram` seeds exercises without instructions | Bootstrap-created exercises have null instructions/media. `ExerciseInstructionsPanel` renders nothing. No error, no crash — expected behavior for non-seeded exercises. |

---

## Testing Strategy

### Unit Tests (Vitest)

| Test file | What it covers |
|---|---|
| `src/lib/youtube.test.ts` | `extractVideoId`: standard `youtube.com/watch?v=` URL, `youtu.be/` short URL, `youtube.com/shorts/` URL, URL with extra params (`&t=`, `&list=`), malformed URL returns `null`, non-YouTube URL returns `null`, empty string returns `null`. `getYouTubeThumbnail`: returns correct `img.youtube.com` URL, returns `null` for invalid input. |
| `src/lib/storage.test.ts` | `getExerciseImageUrl`: builds correct URL from relative path, handles edge cases (empty string, path with special characters). |
| `src/hooks/useExerciseFromLibrary.test.tsx` | Returns matching exercise when library is cached. Returns `undefined` when exercise ID doesn't exist. Returns `undefined` while loading. |
| `src/components/exercise/InstructionSection.test.tsx` | Renders title + items. Renders nothing when items is empty array. Renders nothing when items is undefined. |
| `src/components/exercise/ExerciseInstructionsPanel.test.tsx` | Renders nothing when exercise has no instructions/media. Renders collapsible trigger when exercise has content. Expands on click to show instruction sections. Shows image when `image_url` is present. Hides image on load error. |

### E2E Tests (Playwright)

No new E2E tests required for this epic. Existing `e2e/workout-session.spec.ts` and `e2e/builder-crud.spec.ts` should continue to pass — the new components are additive and do not change existing behavior. If instructions are populated in the test seed, an optional E2E smoke test can verify the collapsible opens and shows content.
