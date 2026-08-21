export type SessionFact = {
  id: string
  started_at: string
  finished_at: string
  active_duration_ms: number | null
  program_id: string | null
  has_catalog_circuit: boolean
}

export type SetFact = {
  session_id: string
  exercise_id: string
  was_pr: boolean
  rir: number | null
  weight_logged: number
  reps: string | null
  duration_seconds: number | null
  block_exercise_id: string | null
}

export type ProfileSnapshot = {
  sessions: SessionFact[]
  sets: SetFact[]
}

export type YearMixCounts = {
  programme: number
  quickWorkout: number
  circuits: number
}

export type YearRollup = {
  year: number
  mix: YearMixCounts
  tonnage_kg: number
  pr_pairs: number
  rir0_num: number
  rir0_den: number
  session_count: number
  duration_ms: number
}

export type AllTimeRegular = {
  exercise_id: string
  reps: number | null
  last_logged_at: string
}

export type ProfileAllTimeRollups = {
  years: YearRollup[]
  program_ids: string[]
  regulars: AllTimeRegular[]
  pr_exercise_count: number
  last_pr_day: string | null
}

export type PulseVm =
  | { status: "empty" }
  | {
      status: "ok"
      sessions: number
      sessionDelta: number | null
      durationMs: number
      durationDeltaMs: number | null
      avgMinutes: number
      prescribedMinutes: number | null
    }

export type MixSeries = {
  programme: number[]
  quickWorkout: number[]
  circuits: number[]
}

export type MixVm =
  | { status: "empty" }
  | {
      status: "ok"
      categories: string[]
      series: MixSeries
    }

export type RhythmVm = {
  categories: string[]
  hits: number[]
}
