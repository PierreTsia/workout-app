// PWA → MCP shape adapter for Quick Workout AI commits (T128 / T170).
//
// Object-form solos preserve preview prescriptions. Circuits map to MCP
// Circuit Items (`type: "circuit"`, nested amount/weight_kg).

import type {
  GeneratedCircuit,
  GeneratedDayItem,
  GeneratedExercise,
  GeneratedWorkout,
} from "@/types/generator"

const FALLBACK_DURATION_SECONDS = 30

export interface McpWorkoutDaySolo {
  exercise_id: string
  sets: number
  reps: string
  weight_kg: number
  rest_seconds: number
  target_duration_seconds?: number
}

export interface McpWorkoutDayCircuit {
  type: "circuit"
  label?: string
  rounds: number
  rest_seconds: number
  transition_seconds: number
  exercises: Array<{ exercise_id: string; amount: number; weight_kg: number }>
}

export type McpWorkoutDayExercise = McpWorkoutDaySolo | McpWorkoutDayCircuit

/** @deprecated Prefer workoutDayItemsToMcpExercises when dayItems exist. */
export function workoutToMcpExercises(
  exercises: GeneratedExercise[],
): McpWorkoutDaySolo[] {
  return exercises.map(toMcpSolo)
}

export function workoutDayItemsToMcpExercises(
  workout: GeneratedWorkout,
): McpWorkoutDayExercise[] {
  if (workout.dayItems && workout.dayItems.length > 0) {
    return workout.dayItems.map(dayItemToMcp)
  }
  return workoutToMcpExercises(workout.exercises)
}

function dayItemToMcp(item: GeneratedDayItem): McpWorkoutDayExercise {
  if (item.kind === "solo") return toMcpSolo(item.exercise)
  return toMcpCircuit(item.circuit)
}

function toMcpCircuit(circuit: GeneratedCircuit): McpWorkoutDayCircuit {
  return {
    type: "circuit",
    ...(circuit.label ? { label: circuit.label } : {}),
    rounds: circuit.rounds,
    rest_seconds: circuit.restSeconds,
    transition_seconds: circuit.transitionSeconds,
    exercises: circuit.exercises.map((ex) => ({
      exercise_id: ex.exercise.id,
      amount: ex.amount,
      weight_kg:
        ex.exercise.equipment === "bodyweight" ? 0 : ex.weightKg,
    })),
  }
}

function toMcpSolo(ge: GeneratedExercise): McpWorkoutDaySolo {
  const isBodyweight = ge.exercise.equipment === "bodyweight"
  const isDuration = ge.exercise.measurement_type === "duration"

  const base: McpWorkoutDaySolo = {
    exercise_id: ge.exercise.id,
    sets: ge.sets,
    reps: ge.reps,
    weight_kg: isBodyweight ? 0 : (ge.weightKg ?? 0),
    rest_seconds: ge.restSeconds,
  }

  if (isDuration) {
    base.target_duration_seconds =
      ge.targetDurationSeconds ??
      ge.exercise.default_duration_seconds ??
      FALLBACK_DURATION_SECONDS
  }

  return base
}
