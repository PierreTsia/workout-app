import type { ExerciseListItem, PerRoundCell } from "@/types/database"
import type { GeneratedCircuit } from "@/types/generator"

export const DEFAULT_BLOCK_ROUNDS = 3
export const DEFAULT_BLOCK_REPS = 10
export const DEFAULT_BLOCK_DURATION_SECONDS = 30
export const DEFAULT_BLOCK_REST_SECONDS = 90
export const DEFAULT_BLOCK_TRANSITION_SECONDS = 0

/** Row for `exercise_blocks` insert (no id; assigned by the DB). */
export interface ExerciseBlockInsertRow {
  workout_day_id: string
  label: string | null
  rounds: number
  rest_seconds: number
  transition_seconds: number
  sort_order: number
  mode: "rounds" | "amrap"
  cap_seconds: number | null
}

/** Row for `block_exercises` insert (no id/block_id; block_id filled after the block insert returns). */
export interface BlockExerciseInsertRow {
  exercise_id: string
  name_snapshot: string
  muscle_snapshot: string
  emoji_snapshot: string
  position: number
  per_round: PerRoundCell[]
}

interface BuildBlockInsertRowsArgs {
  dayId: string
  libraryExercises: ExerciseListItem[]
  /** Highest existing sort_order in the day across solos and blocks; -1 if empty. */
  existingMaxSortOrder: number
  rounds?: number
  label?: string | null
}

function defaultPerRound(
  exercise: ExerciseListItem,
  rounds: number,
): PerRoundCell[] {
  const amount =
    exercise.measurement_type === "duration"
      ? exercise.default_duration_seconds ?? DEFAULT_BLOCK_DURATION_SECONDS
      : DEFAULT_BLOCK_REPS
  return Array.from({ length: rounds }, () => ({ amount, weight: 0 }))
}

export function buildBlockInsertRows({
  dayId,
  libraryExercises,
  existingMaxSortOrder,
  rounds = DEFAULT_BLOCK_ROUNDS,
  label = null,
}: BuildBlockInsertRowsArgs): {
  block: ExerciseBlockInsertRow
  blockExercises: BlockExerciseInsertRow[]
} {
  const block: ExerciseBlockInsertRow = {
    workout_day_id: dayId,
    label,
    rounds,
    rest_seconds: DEFAULT_BLOCK_REST_SECONDS,
    transition_seconds: DEFAULT_BLOCK_TRANSITION_SECONDS,
    sort_order: existingMaxSortOrder + 1,
    mode: "rounds",
    cap_seconds: null,
  }

  const blockExercises: BlockExerciseInsertRow[] = libraryExercises.map(
    (exercise, position) => ({
      exercise_id: exercise.id,
      name_snapshot: exercise.name,
      muscle_snapshot: exercise.muscle_group,
      emoji_snapshot: exercise.emoji ?? "🏋️",
      position,
      per_round: defaultPerRound(exercise, rounds),
    }),
  )

  return { block, blockExercises }
}

/**
 * Build Circuit insert rows from a Quick Workout / AI preview Circuit
 * (T170 Bugbot — Save for Later must persist exercise_blocks).
 */
export function buildGeneratedCircuitInsertRows(
  dayId: string,
  sortOrder: number,
  circuit: GeneratedCircuit,
): {
  block: ExerciseBlockInsertRow
  blockExercises: BlockExerciseInsertRow[]
} {
  const rounds = circuit.rounds
  return {
    block: {
      workout_day_id: dayId,
      label: circuit.label?.trim() ? circuit.label.trim() : null,
      rounds,
      rest_seconds: circuit.restSeconds,
      transition_seconds: circuit.transitionSeconds,
      sort_order: sortOrder,
      mode: "rounds",
      cap_seconds: null,
    },
    blockExercises: circuit.exercises.map((nested, position) => {
      const isBodyweight = nested.exercise.equipment === "bodyweight"
      return {
        exercise_id: nested.exercise.id,
        name_snapshot: nested.exercise.name,
        muscle_snapshot: nested.exercise.muscle_group,
        emoji_snapshot: nested.exercise.emoji ?? "🏋️",
        position,
        per_round: Array.from({ length: rounds }, () => ({
          amount: nested.amount,
          weight: isBodyweight ? 0 : nested.weightKg,
        })),
      }
    }),
  }
}

/** Persist shape for an AMRAP Circuit: cap in seconds, template length 1. */
export function buildAmrapPersistPayload(
  minutes: number,
  exercises: { id: string; per_round: PerRoundCell[] }[],
): {
  block: {
    mode: "amrap"
    cap_seconds: number
    rounds: 1
    rest_seconds: 0
    transition_seconds: 0
  }
  exercises: { id: string; per_round: PerRoundCell[] }[]
} {
  return {
    block: {
      mode: "amrap",
      cap_seconds: minutes * 60,
      rounds: 1,
      rest_seconds: 0,
      transition_seconds: 0,
    },
    exercises: exercises.map((ex) => ({
      id: ex.id,
      per_round: ex.per_round.slice(0, 1),
    })),
  }
}
