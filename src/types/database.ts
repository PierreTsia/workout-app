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
}

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

export interface SetLog {
  id: string
  session_id: string
  exercise_id: string
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

export type FeedbackSourceScreen = "workout" | "builder" | "library_picker"

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
