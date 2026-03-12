import { describe, it, expect } from "vitest"
import { computeEpley1RM } from "./epley"

describe("computeEpley1RM", () => {
  it("computes 1RM for a normal case", () => {
    expect(computeEpley1RM(100, 10)).toBeCloseTo(133.33, 2)
  })

  it("returns weight unchanged when reps = 1", () => {
    expect(computeEpley1RM(100, 1)).toBe(100)
  })

  it("returns 0 when weight is 0", () => {
    expect(computeEpley1RM(0, 10)).toBe(0)
  })

  it("returns 0 when reps is 0", () => {
    expect(computeEpley1RM(100, 0)).toBe(0)
  })

  it("returns 0 when reps is negative", () => {
    expect(computeEpley1RM(100, -1)).toBe(0)
  })

  it("returns 0 when weight is negative", () => {
    expect(computeEpley1RM(-50, 10)).toBe(0)
  })

  it("returns 0 when weight is NaN", () => {
    expect(computeEpley1RM(NaN, 10)).toBe(0)
  })

  it("returns 0 when reps is Infinity", () => {
    expect(computeEpley1RM(100, Infinity)).toBe(0)
  })

  it("returns 0 when both inputs are NaN", () => {
    expect(computeEpley1RM(NaN, NaN)).toBe(0)
  })

  it("handles high reps correctly", () => {
    expect(computeEpley1RM(60, 30)).toBeCloseTo(120, 2)
  })
})
