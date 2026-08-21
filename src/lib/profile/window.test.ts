import { describe, expect, it } from "vitest"
import { includeDeltas, MIX_CATEGORIES, pierreMixSeries } from "./window"

describe("profile window", () => {
  it("omits vs-prior deltas on all-time", () => {
    expect(includeDeltas("7")).toBe(true)
    expect(includeDeltas("all")).toBe(false)
  })

  it("caps 1y Mix grain at 12 months", () => {
    expect(MIX_CATEGORIES["365"]).toHaveLength(12)
  })

  it("stacks Programme, Quick Workout, and Circuits on the Pierre Mix", () => {
    const series = pierreMixSeries("7")
    expect(series.programme.some((n) => n > 0)).toBe(true)
    expect(series.quickWorkout.some((n) => n > 0)).toBe(true)
    expect(series.circuits.some((n) => n > 0)).toBe(true)
  })
})
