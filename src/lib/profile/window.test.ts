import { describe, expect, it } from "vitest"
import {
  includeDeltas,
  MIX_CATEGORIES,
  pierreMixSeries,
  pierrePulse,
  PROFILE_WINDOW_KINDS,
  type MixSeries,
} from "./window"

function typesOnTick(series: MixSeries, i: number): number {
  return [series.programme[i], series.quickWorkout[i], series.circuits[i]].filter(
    (n) => n > 0,
  ).length
}

describe("profile window", () => {
  it("omits vs-prior deltas on all-time", () => {
    expect(includeDeltas("7")).toBe(true)
    expect(includeDeltas("all")).toBe(false)
  })

  it("gives Pierre 7d a negative time-under-bar delta", () => {
    expect(pierrePulse("7").timeDelta).toBeLessThan(0)
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

  it.each(PROFILE_WINDOW_KINDS)(
    "puts two Mix types on the same Pierre %s tick",
    (kind) => {
      const series = pierreMixSeries(kind)
      const stacked = series.programme.some((_, i) => typesOnTick(series, i) >= 2)
      expect(stacked).toBe(true)
    },
  )
}))
