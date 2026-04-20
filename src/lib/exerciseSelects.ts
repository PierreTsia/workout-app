/**
 * Canonical PostgREST `select` strings for the `exercises` table.
 *
 * Keeping these in one place prevents schema drift between hooks that read
 * the same data at different fidelities (slim list vs full per-id vs embed).
 *
 * Adding a new column to the `Exercise` type? Also add it to
 * `FULL_EXERCISE_SELECT`. Adding a field consumed by the pool-style lookup
 * hooks? Add it to `SLIM_EXERCISE_SELECT` and `ExerciseListItem` in
 * `@/types/database`.
 */

/**
 * Slim projection for catalog-style fetches (exercise library list, AI
 * generator pool). Drops rich-but-optional fields like `instructions` JSONB,
 * `youtube_url`, and admin metadata (`source`, `reviewed_*`, `created_at`).
 *
 * Consumers get `ExerciseListItem`. Rich fields are deferred to the per-id
 * flow (`useExerciseById`) or the day-view embed (which uses FULL).
 */
export const SLIM_EXERCISE_SELECT =
  "id, name, name_en, emoji, muscle_group, equipment, image_url, difficulty_level, is_system, measurement_type, default_duration_seconds, secondary_muscles"

/**
 * Full projection for the workout day embed
 * (`workout_exercises.exercise:exercises(<FULL>)`) and for `useExerciseById`.
 *
 * Enumerated rather than `*` to prevent a future migration from silently
 * bloating every embedded row — every column on `exercises` ships in every
 * `workout_exercises` row when the relation is embedded, so adding a heavy
 * JSONB/blob column via `*` would tax every day-view payload.
 *
 * Mirrors the full `Exercise` type so the returned shape stays safe to cache
 * under `["exercise", id]` for both session and admin consumers.
 */
export const FULL_EXERCISE_SELECT =
  "id, name, name_en, emoji, muscle_group, equipment, image_url, difficulty_level, is_system, measurement_type, default_duration_seconds, secondary_muscles, instructions, youtube_url, source, reviewed_at, reviewed_by, created_at"
