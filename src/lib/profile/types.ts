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
