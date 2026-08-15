import type { ExerciseListItem } from "./database"

export type Duration = 15 | 30 | 45 | 60 | 90

export type EquipmentCategory = "bodyweight" | "dumbbells" | "full-gym"

export interface GeneratorConstraints {
  duration: Duration
  /** At least one. If `"full-gym"` is present, it must be the only entry. */
  equipmentCategories: EquipmentCategory[]
  muscleGroups: string[]
  /** Optional AI hint (Quick Generate ignores). Max length enforced in UI and edge. */
  focusAreas?: string
}

export interface GeneratedExercise {
  // Narrowed to the slim catalog shape (T69). The only rich field the
  // generator consumes is `secondary_muscles` (isCompound), which is now
  // in ExerciseListItem.
  exercise: ExerciseListItem
  sets: number
  reps: string
  restSeconds: number
  isCompound: boolean
  /**
   * Optional explicit prescription weight for object-form MCP `create_program`
   * (T74). Web AI generator does NOT set this — bare-string fallback uses "0".
   * Persisted verbatim to `workout_exercises.weight` (TEXT column).
   */
  weightKg?: number
  /**
   * Optional explicit reps-range bounds for freezing progression on weighted
   * reps prescriptions (T74). Both must be set together. Bodyweight branch
   * IGNORES these (T75 enforces the always-auto-derive rule).
   */
  repRangeMin?: number
  repRangeMax?: number
  /**
   * Optional explicit set-range bounds for freezing progression. Same all-or-
   * nothing semantics as repRangeMin/Max.
   */
  setRangeMin?: number
  setRangeMax?: number
  /**
   * Optional explicit duration target for object-form duration prescriptions
   * (T75). Reps-mode exercises must reject this via cross-field validation
   * before reaching the persistence layer.
   */
  targetDurationSeconds?: number
}

/** Circuit nested in a Quick Workout / AI preview (T170 / ADR 0011). */
export interface GeneratedCircuitExercise {
  exercise: ExerciseListItem
  amount: number
  weightKg: number
}

export interface GeneratedCircuit {
  label?: string
  mode?: "rounds" | "amrap"
  capMinutes?: number
  rounds: number
  restSeconds: number
  transitionSeconds: number
  exercises: GeneratedCircuitExercise[]
}

export type GeneratedDayItem =
  | { kind: "solo"; exercise: GeneratedExercise }
  | { kind: "circuit"; circuit: GeneratedCircuit }

export interface GeneratedWorkout {
  exercises: GeneratedExercise[]
  /** Interleaved solos + Circuits when present (QW Circuit path). */
  dayItems?: GeneratedDayItem[]
  name: string
  hasFallback: boolean
  /** Present when built via AI Generate; cleared after shuffle / Quick Generate. */
  rationale?: string
}
