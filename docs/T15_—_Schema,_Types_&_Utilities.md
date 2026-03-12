# T15 — Schema, Types & Utilities

## Goal

Land the foundation layer for the Exercise Demo & Instructions epic: database migration (3 new columns + Supabase Storage bucket), updated TypeScript types, utility functions for YouTube URL parsing and storage URL building, the `useExerciseFromLibrary` hook, and the `exercise` i18n namespace. This ticket produces zero UI — it's the infrastructure that T16, T17, and T18 build on.

## Dependencies

None. This is the first ticket in the epic.

## Scope

### Database Migration

File: `supabase/migrations/YYYYMMDD_add_exercise_instructions.sql`

| Change | Detail |
|---|---|
| `ALTER TABLE exercises ADD COLUMN youtube_url text` | Nullable. Full YouTube URL for curated instructional video. |
| `ALTER TABLE exercises ADD COLUMN instructions jsonb` | Nullable. Structured JSONB with keys: `setup`, `movement`, `breathing`, `common_mistakes` (each `string[]`). |
| `ALTER TABLE exercises ADD COLUMN image_url text` | Nullable. Relative path within the `exercise-media` Supabase Storage bucket. |
| `INSERT INTO storage.buckets` | Create `exercise-media` bucket with `public = true`. |
| `CREATE POLICY` on `storage.objects` | Public `SELECT` access for `bucket_id = 'exercise-media'`. |

Verify the migration runs cleanly on a fresh `supabase db reset` and on an existing database with seeded exercises (new columns should be `null` for all existing rows).

### TypeScript Types

File: `file:src/types/database.ts`

Add `ExerciseInstructions` interface and extend `Exercise`:

```typescript
export interface ExerciseInstructions {
  setup: string[]
  movement: string[]
  breathing: string[]
  common_mistakes: string[]
}
```

Update `Exercise` to include:
- `youtube_url: string | null`
- `instructions: ExerciseInstructions | null`
- `image_url: string | null`

Ensure no type errors arise across the codebase — `useExerciseLibrary`, `useAddExerciseToDay`, `useBootstrapProgram`, and `ExerciseLibraryPicker` all consume the `Exercise` type.

### YouTube Utilities

File: `src/lib/youtube.ts`

| Function | Signature | Behavior |
|---|---|---|
| `extractVideoId` | `(url: string) => string \| null` | Parses `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/` formats. Returns video ID or `null` for malformed/non-YouTube URLs. |
| `getYouTubeThumbnail` | `(url: string) => string \| null` | Calls `extractVideoId`, returns `https://img.youtube.com/vi/{id}/mqdefault.jpg` or `null`. |

### Storage Utility

File: `src/lib/storage.ts`

| Function | Signature | Behavior |
|---|---|---|
| `getExerciseImageUrl` | `(imagePath: string) => string` | Returns `{VITE_SUPABASE_URL}/storage/v1/object/public/exercise-media/{imagePath}`. Reads `VITE_SUPABASE_URL` from `import.meta.env`. |

### Hook

File: `src/hooks/useExerciseFromLibrary.ts`

| Hook | Signature | Behavior |
|---|---|---|
| `useExerciseFromLibrary` | `(exerciseId: string) => { data: Exercise \| undefined, isLoading: boolean }` | Wraps `useExerciseLibrary()`. If cache is warm, instant in-memory lookup. If cold, triggers the `["exercise-library"]` TanStack Query fetch (deduplicated). Returns `exercises?.find(e => e.id === exerciseId)`. |

### i18n Namespace

Files: `src/locales/en/exercise.json`, `src/locales/fr/exercise.json`

| Key | EN | FR |
|---|---|---|
| `howToPerform` | How to perform | Comment exécuter |
| `setup` | Setup | Mise en place |
| `movement` | Movement | Mouvement |
| `breathing` | Breathing | Respiration |
| `commonMistakes` | Common mistakes | Erreurs fréquentes |
| `watchOnYouTube` | Watch on YouTube | Voir sur YouTube |

Register the `exercise` namespace in `file:src/lib/i18n.ts`: add to `ns` array and import both locale files.

### Unit Tests

| Test file | Coverage |
|---|---|
| `src/lib/youtube.test.ts` | `extractVideoId`: standard watch URL, youtu.be short URL, shorts URL, URL with extra params, malformed URL → `null`, non-YouTube URL → `null`, empty string → `null`. `getYouTubeThumbnail`: correct thumbnail URL, `null` for invalid input. |
| `src/lib/storage.test.ts` | `getExerciseImageUrl`: correct URL from relative path, handles empty string, handles special characters. |
| `src/hooks/useExerciseFromLibrary.test.tsx` | Returns matching exercise when library is cached. Returns `undefined` for nonexistent ID. Returns `undefined` while loading. |

## Out of Scope

- UI components (`ExerciseInstructionsPanel`, `InstructionSection`, `YouTubeLink`, `ExerciseInfoDialog`) — those are T16 and T17
- Integration into existing views (`ExerciseDetail`, `ExerciseDetailEditor`, `ExerciseLibraryPicker`) — T16 and T17
- Populating seed data with actual content (instructions, YouTube URLs, images) — T18
- Uploading images to the Supabase Storage bucket — T18

## Acceptance Criteria

- [ ] Migration runs cleanly on `supabase db reset` — exercises table has 3 new nullable columns, `exercise-media` bucket exists with public read policy
- [ ] `Exercise` TypeScript type includes `youtube_url`, `instructions`, `image_url` — no type errors across the codebase
- [ ] `ExerciseInstructions` interface is exported from `database.ts`
- [ ] `extractVideoId` correctly parses all 3 YouTube URL formats and returns `null` for invalid input (unit tests pass)
- [ ] `getYouTubeThumbnail` returns correct `img.youtube.com` URL (unit tests pass)
- [ ] `getExerciseImageUrl` builds correct Supabase Storage public URL (unit tests pass)
- [ ] `useExerciseFromLibrary` returns exercise data from library cache and handles cold cache (unit tests pass)
- [ ] `exercise` i18n namespace loads in both EN and FR without errors
- [ ] Existing tests (`vitest run`) continue to pass with no regressions

## References

- [Epic Brief — Exercise Demo & Instructions](Epic_Brief_—_Exercise_Demo_&_Instructions.md)
- [Tech Plan — Exercise Demo & Instructions](Tech_Plan_—_Exercise_Demo_&_Instructions.md) — Data Model, Table Notes, Testing Strategy sections
