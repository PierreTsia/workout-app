// Tests for `workoutToMcpExercises` (T128, #342). The util converts the
// PWA's rich `GeneratedWorkout` shape into the MCP `create_workout_day`
// object-form payload, so the prescription the user previewed is the
// prescription that gets persisted (no information loss to bare-string
// defaults). Behavioral lock-ins:
//
//   1. Reps exercise → object form with weight_kg=0, no target_duration_seconds.
//   2. Bodyweight reps → weight_kg coerced to 0 even if `weightKg` accidentally set.
//   3. Weighted reps with explicit weightKg → forwarded as weight_kg.
//   4. Duration exercise → reps="0", target_duration_seconds set.
//   5. Duration with explicit targetDurationSeconds → forwarded.
//   6. Duration without explicit targetDurationSeconds → falls back to catalog default.
//   7. Order is preserved (sort_order parity).

import { describe, it, expect } from "vitest"
import {
  workoutDayItemsToMcpExercises,
  workoutToMcpExercises,
} from "./quickWorkout"
import type { GeneratedExercise, GeneratedWorkout } from "@/types/generator"

const REPS_EX: GeneratedExercise = {
  exercise: {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Bench Press",
    name_en: "Bench Press",
    emoji: "💪",
    muscle_group: "chest",
    equipment: "barbell",
    image_url: null,
    difficulty_level: "intermediate",
    is_system: true,
    measurement_type: "reps",
    default_duration_seconds: null,
    secondary_muscles: ["triceps"],
  },
  sets: 4,
  reps: "8-10",
  restSeconds: 120,
  isCompound: true,
}

const BODYWEIGHT_EX: GeneratedExercise = {
  ...REPS_EX,
  exercise: {
    ...REPS_EX.exercise,
    id: "22222222-2222-2222-2222-222222222222",
    name: "Push-up",
    equipment: "bodyweight",
  },
}

const DURATION_EX: GeneratedExercise = {
  ...REPS_EX,
  exercise: {
    ...REPS_EX.exercise,
    id: "33333333-3333-3333-3333-333333333333",
    name: "Plank",
    equipment: "bodyweight",
    measurement_type: "duration",
    default_duration_seconds: 60,
  },
  reps: "0",
  sets: 3,
}

describe("workoutToMcpExercises", () => {
  it("converts a reps exercise to object form with weight_kg=0", () => {
    const result = workoutToMcpExercises([REPS_EX])
    expect(result).toEqual([
      {
        exercise_id: REPS_EX.exercise.id,
        sets: 4,
        reps: "8-10",
        weight_kg: 0,
        rest_seconds: 120,
      },
    ])
  })

  it("forces weight_kg=0 for bodyweight exercises even if weightKg set", () => {
    // Bodyweight + weight_kg > 0 is rejected by MCP (R1). Coerce defensively
    // so we never ship a payload that fails validation downstream — the
    // alternative is leaving a footgun on every callsite.
    const ge: GeneratedExercise = { ...BODYWEIGHT_EX, weightKg: 50 }
    const result = workoutToMcpExercises([ge])
    expect(result[0].weight_kg).toBe(0)
  })

  it("forwards explicit weightKg as weight_kg for non-bodyweight reps", () => {
    const ge: GeneratedExercise = { ...REPS_EX, weightKg: 80 }
    const result = workoutToMcpExercises([ge])
    expect(result[0].weight_kg).toBe(80)
  })

  it("emits target_duration_seconds for duration exercises and reps='0'", () => {
    const result = workoutToMcpExercises([DURATION_EX])
    expect(result[0]).toMatchObject({
      reps: "0",
      target_duration_seconds: 60,
    })
  })

  it("forwards explicit targetDurationSeconds when set", () => {
    const ge: GeneratedExercise = { ...DURATION_EX, targetDurationSeconds: 90 }
    const result = workoutToMcpExercises([ge])
    expect(result[0].target_duration_seconds).toBe(90)
  })

  it("falls back to catalog default_duration_seconds when targetDurationSeconds is unset", () => {
    const result = workoutToMcpExercises([DURATION_EX])
    expect(result[0].target_duration_seconds).toBe(60)
  })

  it("uses 30s default duration when both targetDurationSeconds and catalog default are missing", () => {
    const ge: GeneratedExercise = {
      ...DURATION_EX,
      exercise: { ...DURATION_EX.exercise, default_duration_seconds: null },
    }
    const result = workoutToMcpExercises([ge])
    expect(result[0].target_duration_seconds).toBe(30)
  })

  it("preserves array order", () => {
    const result = workoutToMcpExercises([REPS_EX, DURATION_EX, BODYWEIGHT_EX])
    expect(result.map((e) => e.exercise_id)).toEqual([
      REPS_EX.exercise.id,
      DURATION_EX.exercise.id,
      BODYWEIGHT_EX.exercise.id,
    ])
  })
})

describe("workoutDayItemsToMcpExercises", () => {
  it("T170: maps a Circuit day-item to MCP Circuit Item shape", () => {
    const workout: GeneratedWorkout = {
      name: "AI: Circuit",
      hasFallback: false,
      exercises: [REPS_EX],
      dayItems: [
        { kind: "solo", exercise: REPS_EX },
        {
          kind: "circuit",
          circuit: {
            label: "Finisher",
            rounds: 3,
            restSeconds: 90,
            transitionSeconds: 0,
            exercises: [
              { exercise: BODYWEIGHT_EX.exercise, amount: 10, weightKg: 0 },
              { exercise: DURATION_EX.exercise, amount: 30, weightKg: 0 },
            ],
          },
        },
      ],
    }

    expect(workoutDayItemsToMcpExercises(workout)).toEqual([
      {
        exercise_id: REPS_EX.exercise.id,
        sets: 4,
        reps: "8-10",
        weight_kg: 0,
        rest_seconds: 120,
      },
      {
        type: "circuit",
        label: "Finisher",
        rounds: 3,
        rest_seconds: 90,
        transition_seconds: 0,
        exercises: [
          {
            exercise_id: BODYWEIGHT_EX.exercise.id,
            amount: 10,
            weight_kg: 0,
          },
          {
            exercise_id: DURATION_EX.exercise.id,
            amount: 30,
            weight_kg: 0,
          },
        ],
      },
    ])
  })

  it("T170: falls back to solo mapping when dayItems is absent", () => {
    const workout: GeneratedWorkout = {
      name: "Solo only",
      hasFallback: false,
      exercises: [REPS_EX],
    }
    expect(workoutDayItemsToMcpExercises(workout)).toEqual(
      workoutToMcpExercises([REPS_EX]),
    )
  })
})
