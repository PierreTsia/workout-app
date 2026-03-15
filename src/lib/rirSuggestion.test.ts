import { describe, it, expect } from "vitest"
import { computeIntraSessionSuggestion } from "./rirSuggestion"

describe("computeIntraSessionSuggestion", () => {
  it("reduces weight by one increment when RIR is 0 (failure)", () => {
    const result = computeIntraSessionSuggestion(0, 80, "10", "kg")
    expect(result).toEqual({ weight: 77.5, reps: "10" })
  })

  it("floors weight at one increment when RIR 0 would go below", () => {
    const result = computeIntraSessionSuggestion(0, 2.5, "12", "kg")
    expect(result).toEqual({ weight: 2.5, reps: "12" })
  })

  it("keeps weight and reps when RIR is 1 (very hard)", () => {
    const result = computeIntraSessionSuggestion(1, 60, "8", "kg")
    expect(result).toEqual({ weight: 60, reps: "8" })
  })

  it("keeps weight and reps when RIR is 2 (hard / sweet spot)", () => {
    const result = computeIntraSessionSuggestion(2, 100, "5", "lbs")
    expect(result).toEqual({ weight: 100, reps: "5" })
  })

  it("keeps weight and reps when RIR is 3 (moderate)", () => {
    const result = computeIntraSessionSuggestion(3, 50, "10", "kg")
    expect(result).toEqual({ weight: 50, reps: "10" })
  })

  it("increases weight by one increment when RIR is 4+ (easy)", () => {
    const result = computeIntraSessionSuggestion(4, 80, "10", "kg")
    expect(result).toEqual({ weight: 82.5, reps: "10" })
  })

  it("uses 5 lbs increment for imperial units", () => {
    const result = computeIntraSessionSuggestion(4, 135, "5", "lbs")
    expect(result).toEqual({ weight: 140, reps: "5" })
  })

  it("uses 5 lbs decrement for failure in imperial", () => {
    const result = computeIntraSessionSuggestion(0, 135, "5", "lbs")
    expect(result).toEqual({ weight: 130, reps: "5" })
  })

  it("preserves reps as-is (string passthrough)", () => {
    const result = computeIntraSessionSuggestion(2, 60, "8-10", "kg")
    expect(result).toEqual({ weight: 60, reps: "8-10" })
  })

  it("returns 0 weight when prevWeight is 0 and RIR is 0 (bodyweight)", () => {
    const result = computeIntraSessionSuggestion(0, 0, "10", "kg")
    expect(result).toEqual({ weight: 0, reps: "10" })
  })

  it("returns 0 weight when prevWeight is 0 and RIR is 4+ (bodyweight)", () => {
    const result = computeIntraSessionSuggestion(4, 0, "10", "kg")
    expect(result).toEqual({ weight: 2.5, reps: "10" })
  })

  describe("dumbbell equipment", () => {
    it("uses 2 kg increment for dumbbell RIR 4+ (easy)", () => {
      const result = computeIntraSessionSuggestion(4, 20, "10", "kg", "dumbbell")
      expect(result).toEqual({ weight: 22, reps: "10" })
    })

    it("uses 2 kg decrement for dumbbell RIR 0 (failure)", () => {
      const result = computeIntraSessionSuggestion(0, 20, "10", "kg", "dumbbell")
      expect(result).toEqual({ weight: 18, reps: "10" })
    })

    it("uses 5 lbs increment for dumbbell imperial RIR 4+", () => {
      const result = computeIntraSessionSuggestion(4, 35, "8", "lbs", "dumbbell")
      expect(result).toEqual({ weight: 40, reps: "8" })
    })

    it("keeps weight for dumbbell RIR 1-3", () => {
      const result = computeIntraSessionSuggestion(2, 16, "12", "kg", "dumbbell")
      expect(result).toEqual({ weight: 16, reps: "12" })
    })

    it("floors dumbbell weight at 2 kg on failure", () => {
      const result = computeIntraSessionSuggestion(0, 2, "15", "kg", "dumbbell")
      expect(result).toEqual({ weight: 2, reps: "15" })
    })
  })

  it("uses default increment when equipment is barbell", () => {
    const result = computeIntraSessionSuggestion(4, 80, "5", "kg", "barbell")
    expect(result).toEqual({ weight: 82.5, reps: "5" })
  })

  it("uses default increment when equipment is undefined", () => {
    const result = computeIntraSessionSuggestion(4, 80, "5", "kg", undefined)
    expect(result).toEqual({ weight: 82.5, reps: "5" })
  })
})
