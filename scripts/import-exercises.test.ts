import { describe, it, expect } from "vitest"
import {
  normalizeEquipment,
  resolveMuscleGroup,
  extractTranslation,
  buildExerciseRecord,
  mergeWithExisting,
} from "./import-lib.js"

describe("normalizeEquipment", () => {
  it("returns 'bodyweight' for empty array", () => {
    expect(normalizeEquipment([])).toBe("bodyweight")
  })

  it("maps barbell ID", () => {
    expect(normalizeEquipment([1])).toBe("barbell")
  })

  it("maps dumbbell ID", () => {
    expect(normalizeEquipment([3])).toBe("dumbbell")
  })

  it("maps kettlebell ID", () => {
    expect(normalizeEquipment([10])).toBe("kettlebell")
  })

  it("maps bench IDs", () => {
    expect(normalizeEquipment([8])).toBe("bench")
    expect(normalizeEquipment([9])).toBe("bench")
  })

  it("maps SZ-Bar to ez_bar", () => {
    expect(normalizeEquipment([2])).toBe("ez_bar")
  })

  it("maps resistance band", () => {
    expect(normalizeEquipment([11])).toBe("band")
  })

  it("prefers non-bodyweight equipment when multiple given", () => {
    expect(normalizeEquipment([7, 3])).toBe("dumbbell")
    expect(normalizeEquipment([8, 3])).toBe("bench")
  })

  it("returns 'bodyweight' for bodyweight-only IDs", () => {
    expect(normalizeEquipment([4])).toBe("bodyweight")
    expect(normalizeEquipment([6])).toBe("bodyweight")
    expect(normalizeEquipment([7])).toBe("bodyweight")
  })

  it("returns 'other' for unknown IDs", () => {
    expect(normalizeEquipment([999])).toBe("other")
  })
})

describe("resolveMuscleGroup", () => {
  it("maps pectoralis major to Pectoraux", () => {
    expect(resolveMuscleGroup([4], 11)).toBe("Pectoraux")
  })

  it("maps biceps to Biceps", () => {
    expect(resolveMuscleGroup([1], 8)).toBe("Biceps")
  })

  it("maps triceps to Triceps", () => {
    expect(resolveMuscleGroup([5], 8)).toBe("Triceps")
  })

  it("maps lats to Dos", () => {
    expect(resolveMuscleGroup([12], 12)).toBe("Dos")
  })

  it("maps quads to Quadriceps", () => {
    expect(resolveMuscleGroup([10], 9)).toBe("Quadriceps")
  })

  it("maps hamstrings to Ischios", () => {
    expect(resolveMuscleGroup([11], 9)).toBe("Ischios")
  })

  it("maps calves to Mollets", () => {
    expect(resolveMuscleGroup([7], 14)).toBe("Mollets")
    expect(resolveMuscleGroup([15], 14)).toBe("Mollets")
  })

  it("maps abs to Abdos", () => {
    expect(resolveMuscleGroup([6], 10)).toBe("Abdos")
  })

  it("maps trapezius to Trapèzes", () => {
    expect(resolveMuscleGroup([9], 13)).toBe("Trapèzes")
  })

  it("falls back to category when no muscle ID matches", () => {
    expect(resolveMuscleGroup([], 11)).toBe("Pectoraux")
    expect(resolveMuscleGroup([], 10)).toBe("Abdos")
  })

  it("returns null for unknown muscle and unknown category", () => {
    expect(resolveMuscleGroup([999], 999)).toBeNull()
  })

  it("uses first matching muscle when multiple given", () => {
    expect(resolveMuscleGroup([4, 5], 11)).toBe("Pectoraux")
    expect(resolveMuscleGroup([5, 4], 11)).toBe("Triceps")
  })
})

describe("extractTranslation", () => {
  const translations = [
    { name: "Bankdrücken", language: 1, description: "German desc" },
    { name: "Bench Press", language: 2, description: "English desc" },
    { name: "Développé couché", language: 12, description: "French desc" },
  ]

  it("extracts English translation", () => {
    const result = extractTranslation(translations, 2)
    expect(result?.name).toBe("Bench Press")
  })

  it("extracts French translation", () => {
    const result = extractTranslation(translations, 12)
    expect(result?.name).toBe("Développé couché")
  })

  it("returns undefined for missing language", () => {
    expect(extractTranslation(translations, 99)).toBeUndefined()
  })
})

describe("buildExerciseRecord", () => {
  const baseInfo = {
    id: 73,
    category: { id: 11, name: "Chest" },
    muscles: [{ id: 4, name: "Pectoralis major" }],
    muscles_secondary: [
      { id: 2, name: "Anterior deltoid" },
      { id: 5, name: "Triceps brachii" },
    ],
    equipment: [{ id: 1, name: "Barbell" }, { id: 8, name: "Bench" }],
    translations: [],
  }

  it("builds a complete exercise record", () => {
    const record = buildExerciseRecord(baseInfo, "Développé couché", "Bench Press")
    expect(record).toEqual({
      name: "Développé couché",
      name_en: "Bench Press",
      muscle_group: "Pectoraux",
      equipment: "barbell",
      emoji: "🏋️",
      is_system: false,
      source: "wger:73",
      secondary_muscles: ["Épaules", "Triceps"],
    })
  })

  it("sets is_system to false", () => {
    const record = buildExerciseRecord(baseInfo, "Test", "Test EN")
    expect(record?.is_system).toBe(false)
  })

  it("returns null when no muscle group can be resolved", () => {
    const noMuscle = {
      ...baseInfo,
      muscles: [{ id: 999, name: "Unknown" }],
      category: { id: 999, name: "Unknown" },
    }
    expect(buildExerciseRecord(noMuscle, "Test", "Test EN")).toBeNull()
  })

  it("handles exercises with no secondary muscles", () => {
    const noSecondary = { ...baseInfo, muscles_secondary: [] }
    const record = buildExerciseRecord(noSecondary, "Test", "Test EN")
    expect(record?.secondary_muscles).toBeNull()
  })
})

describe("mergeWithExisting", () => {
  const wgerInfo = {
    id: 73,
    category: { id: 11, name: "Chest" },
    muscles: [{ id: 4, name: "Pectoralis major" }],
    muscles_secondary: [{ id: 5, name: "Triceps brachii" }],
    equipment: [{ id: 1, name: "Barbell" }],
    translations: [],
  }

  it("returns backfill fields without overwriting name", () => {
    const result = mergeWithExisting(wgerInfo, "Bench Press")
    expect(result.name_en).toBe("Bench Press")
    expect(result.equipment).toBe("barbell")
    expect(result.source).toBe("wger:73")
    expect(result.secondary_muscles).toEqual(["Triceps"])
    expect(result).not.toHaveProperty("name")
    expect(result).not.toHaveProperty("instructions")
    expect(result).not.toHaveProperty("youtube_url")
    expect(result).not.toHaveProperty("image_url")
    expect(result).not.toHaveProperty("emoji")
  })
})
