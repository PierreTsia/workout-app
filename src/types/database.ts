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
}

export interface WorkoutDay {
  id: string
  user_id: string
  program_id: string | null
  label: string
  emoji: string
  sort_order: number
  created_at: string
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
}

export interface Session {
  id: string
  user_id: string
  workout_day_id: string | null
  workout_label_snapshot: string
  started_at: string
  finished_at: string | null
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
  reps_logged: string
  weight_logged: number
  estimated_1rm: number | null
  was_pr: boolean
  logged_at: string
  rir: number | null
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
