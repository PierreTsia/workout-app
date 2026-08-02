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
 *
 * `instructions_en` and its status ride along because the same cache entry
 * feeds `ExerciseInstructionsPanel` with no refetch: a row missing the status
 * resolves to French, so a truncated projection would show French in a session
 * and English in the library. `instructions_en_audit` stays out — the review
 * screen fetches it through its own RPC.
 */
export const FULL_EXERCISE_SELECT =
  "id, name, name_en, emoji, muscle_group, equipment, image_url, difficulty_level, is_system, measurement_type, default_duration_seconds, secondary_muscles, instructions, instructions_en, instructions_en_status, youtube_url, source, reviewed_at, reviewed_by, created_at"

/**
 * Smallest projection that can render a localized label (ADR 0010): the name
 * pair plus the two taxonomy values `useCatalogLabels` translates.
 *
 * For embeds on rows that only need a *label*, not the exercise itself — set
 * logs, saved-workout lists, program detail. These are long lists, so the cost
 * of every extra column is paid per row; prefer this over FULL unless the
 * consumer genuinely reads instructions, media or admin metadata.
 */
export const LABEL_EXERCISE_SELECT =
  "id, name, name_en, muscle_group, equipment, emoji"
