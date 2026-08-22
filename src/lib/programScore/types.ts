import type { ExerciseBlockMode } from "@/types/database"

export type ScoreBand = "empty" | "short" | "ok" | "high"

export type MeasurementType = "reps" | "duration"

export type EquipmentMixBucket = "free" | "machine" | "bodyweight" | "other"

export interface IntentSolo {
  sets: number
  restSeconds: number
  repMax: number | null
  measurementType: MeasurementType
  primaryMuscle: string | null
  secondaryMuscles: readonly string[]
  equipment: string
}

export interface IntentStation {
  primaryMuscle: string | null
  secondaryMuscles: readonly string[]
  equipment: string
}

export interface IntentCircuit {
  mode: ExerciseBlockMode
  capSeconds: number | null
  stations: readonly IntentStation[]
}

export interface ProgramIntentDay {
  id: string
  label: string
  sortOrder: number
  solos: readonly IntentSolo[]
  circuits: readonly IntentCircuit[]
}

export interface ProgramIntent {
  programId: string
  days: readonly ProgramIntentDay[]
}

export interface HypertrophyResult {
  band: ScoreBand
  volume: ScoreBand
  frequency: ScoreBand
}

export interface StrengthResult {
  band: ScoreBand
}

export interface EnduranceResult {
  band: ScoreBand
}

export type BalanceResult =
  | { kind: "empty" }
  | { kind: "score"; value: number }

export interface ProgramFacts {
  dayCount: number
  setCount: number
  circuitCount: number
  circuitModes: Readonly<Record<ExerciseBlockMode, number>>
  mix: Readonly<Record<EquipmentMixBucket, number>>
}

export interface ProgramScore {
  hypertrophy: HypertrophyResult
  strength: StrengthResult
  endurance: EnduranceResult
  balance: BalanceResult
  facts: ProgramFacts
}

/** Slim catalog embed (`SLIM_EXERCISE_SELECT`) used by `toIntent`. */
export interface SlimExerciseEmbed {
  muscle_group: string
  secondary_muscles: readonly string[] | null
  equipment: string
  measurement_type?: MeasurementType
}

export interface SlimSoloRow {
  sets: number
  rest_seconds: number
  reps: string
  rep_range_min?: number
  rep_range_max?: number
  muscle_snapshot: string
  exercise: SlimExerciseEmbed | null
}

export interface SlimStationRow {
  muscle_snapshot: string
  exercise: SlimExerciseEmbed | null
}

export interface SlimCircuitRow {
  mode: ExerciseBlockMode
  cap_seconds: number | null
  /** Present on `exercise_blocks`. Never a set multiplier. */
  rounds?: number
  exercises: readonly SlimStationRow[]
}

export interface SlimDayRow {
  id: string
  label: string
  sort_order: number
  workout_exercises: readonly SlimSoloRow[]
  exercise_blocks: readonly SlimCircuitRow[] | null
}
