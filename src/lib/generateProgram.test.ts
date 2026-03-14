import { describe, it, expect } from "vitest"
import { adaptForExperience, resolveEquipmentSwap } from "./generateProgram"
import type { ExerciseAlternative } from "@/types/onboarding"

describe("adaptForExperience", () => {
  const REP_RANGE = "8-12"
  const BASE_SETS = 3
  const BASE_REST = 90

  describe("beginner", () => {
    it("uses max reps, at least 3 sets, +15s rest", () => {
      const result = adaptForExperience(REP_RANGE, BASE_SETS, BASE_REST, "beginner")
      expect(result).toEqual({ reps: "12", sets: 3, restSeconds: 105 })
    })

    it("bumps sets to 3 when base is lower", () => {
      const result = adaptForExperience(REP_RANGE, 2, BASE_REST, "beginner")
      expect(result.sets).toBe(3)
    })

    it("keeps sets when base is already >= 3", () => {
      const result = adaptForExperience(REP_RANGE, 4, BASE_REST, "beginner")
      expect(result.sets).toBe(4)
    })
  })

  describe("intermediate", () => {
    it("uses midpoint reps, 3-4 sets, base rest", () => {
      const result = adaptForExperience(REP_RANGE, BASE_SETS, BASE_REST, "intermediate")
      expect(result).toEqual({ reps: "10", sets: 3, restSeconds: 90 })
    })

    it("caps sets at 4", () => {
      const result = adaptForExperience(REP_RANGE, 5, BASE_REST, "intermediate")
      expect(result.sets).toBe(4)
    })

    it("bumps sets to 3 when base is lower", () => {
      const result = adaptForExperience(REP_RANGE, 2, BASE_REST, "intermediate")
      expect(result.sets).toBe(3)
    })
  })

  describe("advanced", () => {
    it("uses min reps, baseSets+1, -15s rest", () => {
      const result = adaptForExperience(REP_RANGE, BASE_SETS, BASE_REST, "advanced")
      expect(result).toEqual({ reps: "8", sets: 4, restSeconds: 75 })
    })

    it("caps sets at 5", () => {
      const result = adaptForExperience(REP_RANGE, 5, BASE_REST, "advanced")
      expect(result.sets).toBe(5)
    })

    it("floors rest at 30s", () => {
      const result = adaptForExperience(REP_RANGE, BASE_SETS, 30, "advanced")
      expect(result.restSeconds).toBe(30)
    })
  })

  describe("non-numeric rep range", () => {
    it("returns values as-is for plank-style ranges", () => {
      const result = adaptForExperience("30-60s", 3, 60, "advanced")
      expect(result).toEqual({ reps: "30-60s", sets: 3, restSeconds: 60 })
    })

    it("returns values as-is for single-number strings", () => {
      const result = adaptForExperience("AMRAP", 3, 60, "beginner")
      expect(result).toEqual({ reps: "AMRAP", sets: 3, restSeconds: 60 })
    })
  })
})

describe("resolveEquipmentSwap", () => {
  const alternatives: ExerciseAlternative[] = [
    { exercise_id: "ex-1", alternative_exercise_id: "alt-1", equipment_context: "minimal" },
    { exercise_id: "ex-1", alternative_exercise_id: "alt-2", equipment_context: "home" },
    { exercise_id: "ex-2", alternative_exercise_id: "alt-3", equipment_context: "minimal" },
  ]

  it("returns original ID for gym equipment", () => {
    expect(resolveEquipmentSwap("ex-1", "gym", alternatives)).toBe("ex-1")
  })

  it("returns alternative for minimal context", () => {
    expect(resolveEquipmentSwap("ex-1", "minimal", alternatives)).toBe("alt-1")
  })

  it("returns alternative for home context", () => {
    expect(resolveEquipmentSwap("ex-1", "home", alternatives)).toBe("alt-2")
  })

  it("returns original ID when no swap exists", () => {
    expect(resolveEquipmentSwap("ex-999", "minimal", alternatives)).toBe("ex-999")
  })

  it("matches the correct equipment context", () => {
    expect(resolveEquipmentSwap("ex-2", "home", alternatives)).toBe("ex-2")
    expect(resolveEquipmentSwap("ex-2", "minimal", alternatives)).toBe("alt-3")
  })
})
