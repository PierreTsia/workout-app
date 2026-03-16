import { describe, it, expect } from "vitest"
import {
  buildPrompt,
  capCatalog,
  getTargetExerciseCount,
  type CatalogExercise,
  type UserProfile,
  type RecentExercise,
} from "./prompt"

function makeExercise(
  overrides: Partial<CatalogExercise> & { id: string },
): CatalogExercise {
  return {
    name_en: "Test Exercise",
    muscle_group: "Pectoraux",
    equipment: "barbell",
    secondary_muscles: null,
    difficulty_level: "intermediate",
    ...overrides,
  }
}

const CATALOG: CatalogExercise[] = [
  makeExercise({ id: "1", muscle_group: "Pectoraux" }),
  makeExercise({ id: "2", muscle_group: "Dos" }),
  makeExercise({ id: "3", muscle_group: "Biceps" }),
]

const PROFILE: UserProfile = {
  experience: "intermediate",
  goal: "hypertrophy",
  equipment: "full-gym",
  training_days_per_week: 4,
}

const HISTORY: RecentExercise[] = [
  { exercise_id: "abc", exercise_name_snapshot: "Bench Press" },
  { exercise_id: "def", exercise_name_snapshot: "Squat" },
]

describe("buildPrompt", () => {
  it("includes all sections when full context is provided", () => {
    const prompt = buildPrompt(CATALOG, PROFILE, HISTORY, {
      duration: 30,
      equipmentCategory: "full-gym",
      muscleGroups: ["Pectoraux"],
    })

    expect(prompt).toContain("RULES:")
    expect(prompt).toContain("USER PROFILE:")
    expect(prompt).toContain("intermediate")
    expect(prompt).toContain("RECENT EXERCISES")
    expect(prompt).toContain("Bench Press")
    expect(prompt).toContain("EXERCISE CATALOG:")
    expect(prompt).toContain("CONSTRAINTS:")
  })

  it("omits USER PROFILE section when profile is null", () => {
    const prompt = buildPrompt(CATALOG, null, HISTORY, {
      duration: 30,
      equipmentCategory: "full-gym",
      muscleGroups: ["Pectoraux"],
    })

    expect(prompt).not.toContain("USER PROFILE:")
    expect(prompt).toContain("RECENT EXERCISES")
  })

  it("omits RECENT EXERCISES section when history is empty", () => {
    const prompt = buildPrompt(CATALOG, PROFILE, [], {
      duration: 30,
      equipmentCategory: "full-gym",
      muscleGroups: ["Pectoraux"],
    })

    expect(prompt).not.toContain("RECENT EXERCISES")
    expect(prompt).toContain("USER PROFILE:")
  })

  it("shows Full Body focus when muscleGroups includes full-body", () => {
    const prompt = buildPrompt(CATALOG, null, [], {
      duration: 45,
      equipmentCategory: "full-gym",
      muscleGroups: ["full-body"],
    })

    expect(prompt).toContain("Focus: Full Body")
    expect(prompt).toContain("Target exercise count: 7")
  })

  it("uses compact keys in catalog serialization", () => {
    const prompt = buildPrompt(CATALOG, null, [], {
      duration: 30,
      equipmentCategory: "full-gym",
      muscleGroups: ["Pectoraux"],
    })

    expect(prompt).toContain('"id"')
    expect(prompt).toContain('"n"')
    expect(prompt).toContain('"mg"')
    expect(prompt).toContain('"eq"')
  })
})

describe("capCatalog", () => {
  it("returns catalog unchanged when under max size", () => {
    const result = capCatalog(CATALOG)
    expect(result).toHaveLength(3)
  })

  it("caps at 15 per muscle group when over 120 total", () => {
    const bigCatalog: CatalogExercise[] = []
    const groups = ["Pectoraux", "Dos", "Biceps", "Triceps", "Quadriceps",
      "Ischio-jambiers", "Épaules", "Abdominaux", "Mollets"]
    for (const mg of groups) {
      for (let i = 0; i < 20; i++) {
        bigCatalog.push(makeExercise({ id: `${mg}-${i}`, muscle_group: mg }))
      }
    }
    expect(bigCatalog).toHaveLength(180)

    const result = capCatalog(bigCatalog)
    expect(result.length).toBeLessThanOrEqual(9 * 15)

    const counts = new Map<string, number>()
    for (const e of result) {
      counts.set(e.muscle_group, (counts.get(e.muscle_group) ?? 0) + 1)
    }
    for (const [, count] of counts) {
      expect(count).toBeLessThanOrEqual(15)
    }
  })
})

describe("getTargetExerciseCount", () => {
  it("returns correct counts for known durations", () => {
    expect(getTargetExerciseCount(15)).toBe(4)
    expect(getTargetExerciseCount(30)).toBe(5)
    expect(getTargetExerciseCount(45)).toBe(7)
    expect(getTargetExerciseCount(60)).toBe(9)
    expect(getTargetExerciseCount(90)).toBe(13)
  })

  it("defaults to 5 for unknown duration", () => {
    expect(getTargetExerciseCount(42)).toBe(5)
  })
})
