import { describe, expect, it } from "vitest"
import {
  emptyMixSeries,
  includeDeltas,
  MIX_CATEGORIES,
  pierreMixSeries,
  pierrePulse,
  pierreRhythmHits,
  PIERRE_WEEKLY_TARGET,
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
      expect(series.programme).toHaveLength(MIX_CATEGORIES[kind].length)
      const stacked = series.programme.some((_, i) => typesOnTick(series, i) >= 2)
      expect(stacked).toBe(true)
    },
  )

  it("leaves Pierre 7d Sunday empty on Mix", () => {
    const series = pierreMixSeries("7")
    const sun = MIX_CATEGORIES["7"].indexOf("Sun")
    expect(typesOnTick(series, sun)).toBe(0)
  })

  it("gives Pierre 100d Rhythm 12 weeks of target-capped hits with a deload", () => {
    const fixture = pierreRhythmHits("100")
    expect(PIERRE_WEEKLY_TARGET).toBe(4)
    expect(fixture.hits).toHaveLength(12)
    expect(fixture.hits.every((n) => n <= PIERRE_WEEKLY_TARGET)).toBe(true)
    expect(fixture.hits.some((n) => n === PIERRE_WEEKLY_TARGET)).toBe(true)
    expect(fixture.hits.some((n) => n > 0 && n < PIERRE_WEEKLY_TARGET)).toBe(true)
    expect(fixture.deloadAt).toBe(3)
    expect(fixture.hits[3]).toBe(2)
  })

  it("keeps the empty Mix series at zero", () => {
    const series = emptyMixSeries("7")
    expect(series.programme.every((n) => n === 0)).toBe(true)
    expect(series.quickWorkout.every((n) => n === 0)).toBe(true)
    expect(series.circuits.every((n) => n === 0)).toBe(true)
  })
})
