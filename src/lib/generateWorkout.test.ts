import { describe, it, expect } from "vitest"
import { generateWorkout } from "./generateWorkout"
import type { Exercise } from "@/types/database"
import type { GeneratorConstraints } from "@/types/generator"

function fakeExercise(overrides: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: overrides.id,
    muscle_group: "Pectoraux",
    emoji: "💪",
    is_system: true,
    created_at: "",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: "barbell",
    difficulty_level: null,
    name_en: null,
    source: null,
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
    ...overrides,
  }
}

const CHEST_COMPOUND = fakeExercise({
  id: "bench-press",
  name: "Bench Press",
  muscle_group: "Pectoraux",
  equipment: "barbell",
  secondary_muscles: ["Triceps", "Épaules"],
})

const CHEST_ISOLATION = fakeExercise({
  id: "pec-fly",
  name: "Pec Fly",
  muscle_group: "Pectoraux",
  equipment: "machine",
  secondary_muscles: null,
})

const BACK_COMPOUND = fakeExercise({
  id: "pullup",
  name: "Pull-up",
  muscle_group: "Dos",
  equipment: "bodyweight",
  secondary_muscles: ["Biceps"],
})

const SHOULDER_ISOLATION = fakeExercise({
  id: "lateral-raise",
  name: "Lateral Raise",
  muscle_group: "Épaules",
  equipment: "dumbbell",
  secondary_muscles: null,
})

const fullGymPool = [CHEST_COMPOUND, CHEST_ISOLATION, BACK_COMPOUND, SHOULDER_ISOLATION]

describe("generateWorkout", () => {
  const baseConstraints: GeneratorConstraints = {
    duration: 15,
    equipmentCategory: "full-gym",
    muscleGroups: ["Pectoraux"],
  }

  it("returns exercises filtered by muscle group", () => {
    const result = generateWorkout(fullGymPool, baseConstraints)
    expect(result.exercises.length).toBeGreaterThan(0)
    result.exercises.forEach((ge) => {
      expect(ge.exercise.muscle_group).toBe("Pectoraux")
    })
  })

  it("classifies compound vs isolation correctly", () => {
    const result = generateWorkout(fullGymPool, baseConstraints)
    const compoundResult = result.exercises.find(
      (ge) => ge.exercise.id === "bench-press",
    )
    const isolationResult = result.exercises.find(
      (ge) => ge.exercise.id === "pec-fly",
    )
    if (compoundResult) {
      expect(compoundResult.isCompound).toBe(true)
      expect(compoundResult.reps).toBe("10")
      expect(compoundResult.restSeconds).toBe(90)
    }
    if (isolationResult) {
      expect(isolationResult.isCompound).toBe(false)
      expect(isolationResult.reps).toBe("12")
      expect(isolationResult.restSeconds).toBe(60)
    }
  })

  it("respects volume map for 15-min session", () => {
    const result = generateWorkout(fullGymPool, baseConstraints)
    expect(result.exercises.length).toBeLessThanOrEqual(4)
    result.exercises.forEach((ge) => {
      expect(ge.sets).toBe(3)
    })
  })

  it("generates a full-body workout distributing across muscle groups", () => {
    const pool = [
      ...Array.from({ length: 5 }, (_, i) =>
        fakeExercise({ id: `chest-${i}`, muscle_group: "Pectoraux", equipment: "barbell" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        fakeExercise({ id: `back-${i}`, muscle_group: "Dos", equipment: "barbell" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        fakeExercise({ id: `quads-${i}`, muscle_group: "Quadriceps", equipment: "barbell" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        fakeExercise({ id: `shoulders-${i}`, muscle_group: "Épaules", equipment: "dumbbell" }),
      ),
    ]

    const constraints: GeneratorConstraints = {
      duration: 45,
      equipmentCategory: "full-gym",
      muscleGroups: ["full-body"],
    }

    const result = generateWorkout(pool, constraints)
    const groups = new Set(result.exercises.map((ge) => ge.exercise.muscle_group))
    expect(groups.size).toBeGreaterThanOrEqual(3)
    expect(result.exercises.length).toBeLessThanOrEqual(7)
  })

  it("applies adaptive fallback when not enough exercises", () => {
    const sparsePool = [
      fakeExercise({ id: "db-curl", muscle_group: "Biceps", equipment: "dumbbell" }),
      fakeExercise({ id: "bw-curl", muscle_group: "Biceps", equipment: "bodyweight" }),
    ]

    const constraints: GeneratorConstraints = {
      duration: 30,
      equipmentCategory: "dumbbells",
      muscleGroups: ["Biceps"],
    }

    const result = generateWorkout(sparsePool, constraints)
    expect(result.hasFallback).toBe(true)
    expect(result.exercises.length).toBe(2)
  })

  it("returns empty exercises when pool has no matches", () => {
    const result = generateWorkout([], baseConstraints)
    expect(result.exercises).toEqual([])
    expect(result.name).toBeTruthy()
  })

  it("builds a descriptive name from constraints", () => {
    const result = generateWorkout(fullGymPool, baseConstraints)
    expect(result.name).toContain("Pectoraux")
    expect(result.name).toContain("Gym")
    expect(result.name).toContain("15min")
  })

  it("selects from multiple muscle groups when several are specified", () => {
    const pool = [
      ...Array.from({ length: 5 }, (_, i) =>
        fakeExercise({ id: `chest-${i}`, muscle_group: "Pectoraux", equipment: "barbell" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        fakeExercise({ id: `triceps-${i}`, muscle_group: "Triceps", equipment: "barbell" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        fakeExercise({ id: `back-${i}`, muscle_group: "Dos", equipment: "barbell" }),
      ),
    ]

    const constraints: GeneratorConstraints = {
      duration: 30,
      equipmentCategory: "full-gym",
      muscleGroups: ["Pectoraux", "Triceps"],
    }

    const result = generateWorkout(pool, constraints)
    result.exercises.forEach((ge) => {
      expect(["Pectoraux", "Triceps"]).toContain(ge.exercise.muscle_group)
    })
    const groups = new Set(result.exercises.map((ge) => ge.exercise.muscle_group))
    expect(groups.size).toBe(2)
  })

  it("does not fallback to bodyweight when already bodyweight", () => {
    const pool = [
      fakeExercise({ id: "pushup", muscle_group: "Pectoraux", equipment: "bodyweight" }),
    ]

    const constraints: GeneratorConstraints = {
      duration: 30,
      equipmentCategory: "bodyweight",
      muscleGroups: ["Pectoraux"],
    }

    const result = generateWorkout(pool, constraints)
    expect(result.hasFallback).toBe(false)
    expect(result.exercises.length).toBe(1)
  })
})
