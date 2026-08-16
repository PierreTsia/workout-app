export interface ExerciseInstructions {
  setup: string[]
  movement: string[]
  breathing: string[]
  common_mistakes: string[]
}

/**
 * Trace left by the translation pipeline on `exercises.instructions_en_audit`.
 *
 * Nothing reads it at display time — it exists for the review screen, and the
 * contract lives here because T157 writes it and T158 reads it in parallel.
 */
export interface TranslationAudit {
  model: string
  prompt_version: number
  translated_at: string
  checker_model: string | null
  gate_flags: string[]
  objections: {
    section: keyof ExerciseInstructions
    index: number
    verdict: string
    note: string
  }[]
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
  /** English translation, same shape. Only shown when the status allows it. */
  instructions_en?: ExerciseInstructions | null
  /** `clean` | `flagged` | `approved`; null means never translated. */
  instructions_en_status?: string | null
  instructions_en_reviewed_at?: string | null
  instructions_en_audit?: TranslationAudit | null
  image_url: string | null
  equipment: string
  difficulty_level: "beginner" | "intermediate" | "advanced" | null
  name_en: string | null
  source: string | null
  secondary_muscles: string[] | null
  reviewed_at: string | null
  reviewed_by: string | null
  /** Rep-based vs time-based holds; omitted in older clients (treat as reps). */
  measurement_type?: "reps" | "duration"
  /** Default hold length (seconds) when measurement_type is duration; null uses app fallback. */
  default_duration_seconds?: number | null
}

/**
 * Shape returned by `LABEL_EXERCISE_SELECT` — the columns needed to render a
 * localized label, nothing more. Embeds are nullable: the catalog row can be
 * filtered by RLS or simply absent from the payload.
 */
export type ExerciseLabelFields = Pick<
  Exercise,
  "id" | "name" | "name_en" | "muscle_group" | "equipment" | "emoji"
>

export interface WorkoutDay {
  id: string
  user_id: string
  program_id: string | null
  label: string
  emoji: string
  sort_order: number
  created_at: string
  saved_at: string | null
}

export interface WorkoutExercise {
  id: string
  workout_day_id: string
  exercise_id: string
  name_snapshot: string
  muscle_snapshot: string
  emoji_snapshot: string
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  sort_order: number
  /** Per-template override for duration exercises; null uses exercise.default_duration_seconds. */
  target_duration_seconds?: number | null
  /** Triple Progression range boundaries. Present after migration; undefined on legacy rows. */
  rep_range_min?: number
  rep_range_max?: number
  set_range_min?: number
  set_range_max?: number
  /** Per-exercise weight increment override (kg). Null/undefined = engine uses default (2.5 barbell / 2.0 dumbbell). */
  weight_increment?: number | null
  max_weight_reached?: boolean
  /** Duration progression range boundaries. Nullable — only meaningful for duration exercises. */
  duration_range_min_seconds?: number | null
  duration_range_max_seconds?: number | null
  duration_increment_seconds?: number | null
  /**
   * ISO timestamp of the last user-driven mutation to a session-target field
   * (`reps` / `weight` / `sets` / `target_duration_seconds`). Maintained by a
   * Postgres trigger; engine compares against `last_session.finished_at` to
   * decide whether the **Manual Override Window** is open. See ADR 0006.
   */
  template_updated_at: string
}

/**
 * Row shape returned by `useWorkoutExercises` after the T69 embed.
 * `exercise` is null only if the FK row was deleted (RLS filtered or orphan).
 */
export interface WorkoutExerciseWithExercise extends WorkoutExercise {
  exercise: Exercise | null
}

/**
 * A `workout_exercises` row that can resolve a localized label — either straight
 * from the day query (which embeds the full catalog row) or synthesised
 * in-session when the user swaps or adds an exercise from the picker.
 *
 * Narrower than `WorkoutExerciseWithExercise` on purpose: an `ExerciseListItem`
 * from the slim pool satisfies the label fields without being a full `Exercise`,
 * so a swapped row keeps its localized name instead of falling back to the
 * snapshot.
 */
export type WorkoutExerciseWithLabel = WorkoutExercise & {
  exercise: ExerciseLabelFields | null
}

/** One round's prescription for a single block exercise. `amount` = reps or duration seconds (per the exercise's measurement_type). */
export interface PerRoundCell {
  amount: number
  weight: number
}

/** Circuit termination: fixed round count (Tours) or a time cap (AMRAP). */
export type ExerciseBlockMode = "rounds" | "amrap"

/** A superset/circuit: exercises trained round-by-round. See ADR 0007 (#351). */
export interface ExerciseBlock {
  id: string
  workout_day_id: string
  label: string | null
  /** Number of rounds (shared across all exercises of the block). AMRAP = 1 (template length). */
  rounds: number
  /** Rest between rounds (seconds). Forced 0 in AMRAP. */
  rest_seconds: number
  /** Transition between exercises within a round (seconds). Forced 0 in AMRAP. */
  transition_seconds: number
  /** `'rounds'` = Tours (default). `'amrap'` requires `cap_seconds`. */
  mode: ExerciseBlockMode
  /** Time cap in seconds (60–3600). Null iff Tours. */
  cap_seconds: number | null
  /** Catalog identity when this block was instantiated from a Benchmark Circuit. Null / omitted = jetable. */
  benchmark_circuit_id?: string | null
  /** Shared ordering namespace with workout_exercises within a day. */
  sort_order: number
  created_at: string
}

/** Catalog Rx stored as JSONB on `benchmark_circuits`. */
export interface BenchmarkCircuitRxExercise {
  exercise_id: string
  amount: number
  weight: number
}

export interface BenchmarkCircuitRx {
  mode: ExerciseBlockMode
  cap_seconds: number | null
  exercises: BenchmarkCircuitRxExercise[]
}

export interface BenchmarkCircuitReference {
  name: string
  score: string
}

/** Named reusable circuit (GymLogic seed or user Circuit Fork). See ADR 0015. */
export interface BenchmarkCircuit {
  id: string
  slug: string | null
  owner_id: string | null
  forked_from: string | null
  aliases: string[]
  tagline_fr: string | null
  tagline_en: string | null
  story_fr: string | null
  story_en: string | null
  reference: BenchmarkCircuitReference | null
  rx: BenchmarkCircuitRx
  created_at: string
}

/** One AMRAP execution in a session. Tours do not write a row. See ADR 0014. */
export interface BlockRun {
  id: string
  session_id: string
  block_id: string
  started_at: string
  finished_at: string | null
  mode: ExerciseBlockMode
  cap_seconds: number
  template_fingerprint: string
  /** Catalog identity snapped at GO. Null = jetable. Independent of the day's live block FK. */
  benchmark_circuit_id: string | null
}

export interface BlockExercise {
  id: string
  block_id: string
  exercise_id: string
  name_snapshot: string
  muscle_snapshot: string
  emoji_snapshot: string
  /** Order within the block/round. */
  position: number
  /** Per-round prescription, length === block.rounds. */
  per_round: PerRoundCell[]
}

export interface BlockExerciseWithExercise extends BlockExercise {
  exercise: Exercise | null
}

export interface ExerciseBlockWithExercises extends ExerciseBlock {
  exercises: BlockExerciseWithExercise[]
}

/**
 * A position in a workout day's ordered sequence: either a solo exercise or a
 * block. Both carry `sort_order` from the same per-day namespace (Unified Day
 * Sequence, #351).
 */
export type DayItem =
  | { kind: "solo"; sort_order: number; exercise: WorkoutExerciseWithExercise }
  | { kind: "block"; sort_order: number; block: ExerciseBlockWithExercises }

/**
 * Slim projection used by catalog-style fetches (`useExerciseLibrary`) where
 * rich fields like `instructions`/`youtube_url` are deferred to per-id hooks.
 * Includes `measurement_type` + `default_duration_seconds` because the active
 * session pool (`WorkoutPage.exerciseById`) needs them for duration branching.
 */
export type ExerciseListItem = Pick<
  Exercise,
  | "id"
  | "name"
  | "name_en"
  | "emoji"
  | "muscle_group"
  | "equipment"
  | "image_url"
  | "difficulty_level"
  | "is_system"
  | "measurement_type"
  | "default_duration_seconds"
  // `secondary_muscles` is kept because `isCompound` logic in generator flows
  // (PreviewStep, quick workout) branches on presence. Cheap scalar array.
  | "secondary_muscles"
>


export interface Session {
  id: string
  user_id: string
  workout_day_id: string | null
  workout_label_snapshot: string
  started_at: string
  finished_at: string | null
  /** Active training time excluding pause; null for legacy sessions. */
  active_duration_ms: number | null
  total_sets_done: number
  has_skipped_sets: boolean
  cycle_id: string | null
}

export interface Cycle {
  id: string
  program_id: string
  user_id: string
  started_at: string
  finished_at: string | null
}

/** `set_logs` row carrying the joined catalog label fields (T148). */
export interface SetLogWithExercise extends SetLog {
  exercise: ExerciseLabelFields | null
}

export interface SetLog {
  id: string
  session_id: string
  exercise_id: string
  /** Non-null when this log belongs to an Exercise Block cell (#351, ADR 0007). */
  block_exercise_id: string | null
  /**
   * Solo **Exercise Slot** (`workout_exercises.id`). Null for block logs,
   * legacy rows, and orphans after slot delete (#463, ADR 0012).
   */
  workout_exercise_id: string | null
  exercise_name_snapshot: string
  set_number: number
  reps_logged: string | null
  /** Time-based set; mutually exclusive with reps_logged in DB. */
  duration_seconds: number | null
  weight_logged: number
  estimated_1rm: number | null
  was_pr: boolean
  logged_at: string
  rir: number | null
  rest_seconds: number | null
  /** Prescription Snapshot (ADR 0006). */
  prescribed_reps: number | null
  prescribed_weight: number | null
  prescribed_sets: number | null
  prescribed_duration_seconds: number | null
}

export interface CycleStats {
  session_count: number
  total_duration_ms: number
  total_sets: number
  total_volume_kg: number
  pr_count: number
  started_at: string
  last_finished_at: string | null
  duration_days: number
  delta_volume_pct: number | null
  delta_sets_pct: number | null
  delta_prs_pct: number | null
}

export type FeedbackSourceScreen = "workout" | "builder" | "library_picker" | "library"

export interface ExerciseContentFeedbackInsert {
  exercise_id: string
  user_email: string
  user_id: string
  source_screen: FeedbackSourceScreen
  fields_reported: string[]
  error_details: Record<string, string[]>
  other_illustration_text: string | null
  other_video_text: string | null
  other_description_text: string | null
  comment: string | null
}

export type FeedbackStatus = "pending" | "in_review" | "resolved"

export type TransactionalEmailKind = "welcome" | "feedback_ack" | "feedback_resolved"

export interface TransactionalEmailLog {
  id: string
  user_id: string
  email_kind: TransactionalEmailKind
  feedback_id: string | null
  sent_at: string
  provider_id: string | null
}

export interface UserEmailPreferences {
  user_id: string
  feedback_notifications: boolean
  updated_at: string
}

export interface ExerciseContentFeedback {
  id: string
  exercise_id: string
  user_email: string
  user_id: string
  source_screen: FeedbackSourceScreen
  fields_reported: string[]
  error_details: Record<string, string[]>
  other_illustration_text: string | null
  other_video_text: string | null
  other_description_text: string | null
  comment: string | null
  status: FeedbackStatus
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  exercises: { name: string; emoji: string } | null
}
