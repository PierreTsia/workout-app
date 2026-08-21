import { describe, expect, it } from "vitest"
import {
  emptyMixSeries,
  includeDeltas,
  MIX_CATEGORIES,
  pierreMixSeries,
  pierrePulse,
  circuitBestAmrap,
  circuitBestTours,
  circuitSparkValues,
  pierreCircuits,
  pierreCircuitsPulse,
  PIERRE_CIRCUITS,
  pierreRecordsPulse,
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

  it("gives Pierre 7d Circuits a vs-prior on runs", () => {
    const circuits = pierreCircuitsPulse("7")
    expect(circuits.runs).toBe(11)
    expect(circuits.runsDelta).toBeGreaterThan(0)
    expect(circuits.distinct).toBe(3)
    expect(circuits.pbs).toBe(1)
  })

  it("gives Pierre 7d Records a vs-prior on PRs, exercises, and freshness", () => {
    const records = pierreRecordsPulse("7")
    expect(records.prs).toBe(11)
    expect(records.prsDelta).toBeGreaterThan(0)
    expect(records.exercises).toBe(8)
    expect(records.exercisesDelta).toBeGreaterThan(0)
    expect(records.sinceLast).toBe("2d")
    expect(records.sinceDelta).toBeGreaterThan(0)
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

  it("gives Pierre 100d Rhythm 12 weeks with a deload and weeks at 5, 6, and 7", () => {
    const fixture = pierreRhythmHits("100")
    expect(PIERRE_WEEKLY_TARGET).toBe(4)
    expect(fixture.hits).toHaveLength(12)
    expect(fixture.hits).toContain(5)
    expect(fixture.hits).toContain(6)
    expect(fixture.hits).toContain(7)
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

  it("sparks AMRAP as rounds and Tours as seconds", () => {
    const amrap = PIERRE_CIRCUITS.find((row) => row.mode === "amrap")
    const tours = PIERRE_CIRCUITS.find((row) => row.mode === "rounds")
    expect(amrap && circuitSparkValues(amrap)).toEqual([8, 10, 9])
    expect(tours && circuitSparkValues(tours)).toEqual([520, 478, 498])
  })

  it("picks the window best run, not the last", () => {
    const cindy = PIERRE_CIRCUITS.find((row) => row.name === "Cindy")
    const athena = PIERRE_CIRCUITS.find((row) => row.name === "Athena")
    const force = PIERRE_CIRCUITS.find((row) => row.name === "Force")
    expect(cindy?.mode === "amrap" && circuitBestAmrap(cindy.runs)).toEqual({
      fullRounds: 10,
      leftover: 1,
      leftoverName: "pull-ups",
    })
    expect(athena?.mode === "amrap" && circuitBestAmrap(athena.runs)).toEqual({
      fullRounds: 5,
      leftover: 4,
      leftoverName: "sit-ups",
    })
    expect(force?.mode === "rounds" && circuitBestTours(force.runs)).toEqual({
      seconds: 478,
    })
  })

  it("scales per-circuit run counts with the window", () => {
    expect(pierreCircuits("7").map((row) => row.runCount)).toEqual([5, 3, 3])
    expect(pierreCircuits("100").map((row) => row.runCount)).toEqual([
      22, 11, 8,
    ])
  })
})
