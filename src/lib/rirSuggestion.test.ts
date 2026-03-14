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
})
