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
  name_en: string | null
  source: string | null
  secondary_muscles: string[] | null
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface WorkoutDay {
  id: string
  user_id: string
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
}
