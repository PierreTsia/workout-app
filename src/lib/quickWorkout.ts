// PWA → MCP shape adapter for Quick Workout AI commits (T128 / T170 / T192).
//
// Object-form solos preserve preview prescriptions. Circuits map to MCP
// Circuit Items (`type: "circuit"`). AMRAP keeps mode/cap; catalog items
// pass benchmark_slug and omit nested LLM exercises.

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
  mode?: "rounds" | "amrap"
  cap_minutes?: number
  benchmark_slug?: string
  rounds?: number
  rest_seconds?: number
  transition_seconds?: number
  exercises?: Array<{ exercise_id: string; amount: number; weight_kg: number }>
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

function toMcpNestedExercises(circuit: GeneratedCircuit) {
  return circuit.exercises.map((ex) => ({
    exercise_id: ex.exercise.id,
    amount: ex.amount,
    weight_kg: ex.exercise.equipment === "bodyweight" ? 0 : ex.weightKg,
  }))
}

function toMcpCircuit(circuit: GeneratedCircuit): McpWorkoutDayCircuit {
  if (circuit.benchmarkSlug) {
    return {
      type: "circuit",
      benchmark_slug: circuit.benchmarkSlug,
    }
  }

  const label = circuit.label ? { label: circuit.label } : {}
  const nested = { exercises: toMcpNestedExercises(circuit) }
  if (circuit.mode === "amrap") {
    return {
      type: "circuit",
      ...label,
      mode: "amrap",
      cap_minutes: circuit.capMinutes ?? 20,
      ...nested,
    }
  }
  return {
    type: "circuit",
    ...label,
    rounds: circuit.rounds,
    rest_seconds: circuit.restSeconds,
    transition_seconds: circuit.transitionSeconds,
    ...nested,
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
