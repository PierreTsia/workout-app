import { describe, it, expect } from "vitest"
import {
  getEquipmentValues,
  getExerciseBounds,
  capCatalog,
  buildProgramPrompt,
  type CatalogExercise,
} from "../../supabase/functions/generate-program/prompt"

function makeExercise(id: string, group: string): CatalogExercise {
  return {
    id,
    name_en: `Exercise ${id}`,
    muscle_group: group,
    equipment: "dumbbell",
    secondary_muscles: null,
    difficulty_level: "intermediate",
  }
}

describe("getEquipmentValues", () => {
  it("returns bodyweight for bodyweight category", () => {
    expect(getEquipmentValues("bodyweight")).toEqual(["bodyweight"])
  })

  it("returns dumbbell for dumbbells category", () => {
    expect(getEquipmentValues("dumbbells")).toEqual(["dumbbell"])
  })

  it("returns full list for full-gym", () => {
    const result = getEquipmentValues("full-gym")
    expect(result).toContain("barbell")
    expect(result).toContain("cable")
    expect(result).toContain("machine")
    expect(result.length).toBe(8)
  })

  it("returns empty array for unknown category", () => {
    expect(getEquipmentValues("trx")).toEqual([])
  })
})

describe("getExerciseBounds", () => {
  it.each([
    [15, { min: 4, max: 6 }],
    [30, { min: 4, max: 7 }],
    [45, { min: 5, max: 9 }],
    [60, { min: 7, max: 11 }],
    [90, { min: 11, max: 13 }],
  ])("returns correct bounds for %d minutes", (duration, expected) => {
    expect(getExerciseBounds(duration)).toEqual(expected)
  })

  it("defaults to base 7 for unknown duration", () => {
    expect(getExerciseBounds(42)).toEqual({ min: 5, max: 9 })
  })
})

describe("capCatalog", () => {
  it("returns catalog unchanged when under size limit", () => {
    const catalog = Array.from({ length: 50 }, (_, i) => makeExercise(`e${i}`, "chest"))
    expect(capCatalog(catalog)).toHaveLength(50)
  })

  it("caps per group when catalog exceeds limit", () => {
    const catalog: CatalogExercise[] = []
    for (let g = 0; g < 10; g++) {
      for (let i = 0; i < 20; i++) {
        catalog.push(makeExercise(`g${g}_e${i}`, `group_${g}`))
      }
    }
    expect(catalog).toHaveLength(200)

    const capped = capCatalog(catalog)
    expect(capped.length).toBeLessThanOrEqual(150)

    const groups = new Map<string, number>()
    for (const ex of capped) {
      groups.set(ex.muscle_group, (groups.get(ex.muscle_group) ?? 0) + 1)
    }
    for (const count of groups.values()) {
      expect(count).toBeLessThanOrEqual(15)
    }
  })
})

describe("buildProgramPrompt", () => {
  const catalog = [makeExercise("e1", "chest"), makeExercise("e2", "back")]
  const constraints = {
    daysPerWeek: 4,
    duration: 60,
    equipmentCategory: "full-gym",
    goal: "hypertrophy",
    experience: "intermediate",
  }

  it("includes day count and exercise bounds", () => {
    const prompt = buildProgramPrompt(catalog, null, [], constraints, false)
    expect(prompt).toContain("4 days per week")
    expect(prompt).toContain("between 7 and 11 exercises")
  })

  it("includes user profile when provided", () => {
    const profile = {
      experience: "advanced",
      goal: "strength",
      equipment: "full-gym",
      training_days_per_week: 5,
      age: 30,
      gender: "male",
    }
    const prompt = buildProgramPrompt(catalog, profile, [], constraints, false)
    expect(prompt).toContain("Age: 30")
    expect(prompt).toContain("Gender: male")
  })

  it("omits gender when prefer_not_to_say", () => {
    const profile = {
      experience: "beginner",
      goal: "general_fitness",
      equipment: "bodyweight",
      training_days_per_week: 3,
      age: null,
      gender: "prefer_not_to_say",
    }
    const prompt = buildProgramPrompt(catalog, profile, [], constraints, false)
    expect(prompt).not.toContain("Gender:")
  })

  it("includes training gap warning", () => {
    const prompt = buildProgramPrompt(catalog, null, [], constraints, true)
    expect(prompt).toContain("hasn't trained in over 2 weeks")
    expect(prompt).toContain("conservative re-entry")
  })

  it("includes split preference", () => {
    const prompt = buildProgramPrompt(catalog, null, [], { ...constraints, splitPreference: "ppl" }, false)
    expect(prompt).toContain("prefers a ppl split")
  })

  it("includes focus areas", () => {
    const prompt = buildProgramPrompt(catalog, null, [], { ...constraints, focusAreas: "upper body" }, false)
    expect(prompt).toContain("emphasize: upper body")
  })

  it("includes recent exercises", () => {
    const recent = [{ exercise_id: "e1", exercise_name_snapshot: "Bench Press" }]
    const prompt = buildProgramPrompt(catalog, null, recent, constraints, false)
    expect(prompt).toContain("RECENT EXERCISES")
    expect(prompt).toContain("e1 (Bench Press)")
  })

  it("includes serialized catalog", () => {
    const prompt = buildProgramPrompt(catalog, null, [], constraints, false)
    expect(prompt).toContain("EXERCISE CATALOG")
    expect(prompt).toContain('"id":"e1"')
  })
})
