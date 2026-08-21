import { describe, expect, it } from "vitest"
import {
  encodeRhythmGoalDays,
  pierreRhythmSessionDays,
  PROFILE_RHYTHM_END,
  rhythmHeatmapRangeDays,
  RHYTHM_HEAT_GOAL,
  RHYTHM_HEAT_REST,
  RHYTHM_HEAT_SHORT,
} from "./rhythmHeatmap"
import { PIERRE_WEEKLY_TARGET } from "./window"

describe("encodeRhythmGoalDays", () => {
  it("lights trained days at SHORT until the week hits the target, then GOAL", () => {
    const encoded = encodeRhythmGoalDays(
      [
        { date: "2026-08-17", sessions: 1 },
        { date: "2026-08-18", sessions: 1 },
        { date: "2026-08-19", sessions: 1 },
        { date: "2026-08-20", sessions: 0 },
        { date: "2026-08-21", sessions: 0 },
      ],
      4,
    )

    const byDate = Object.fromEntries(encoded.map((d) => [d.date, d.value]))
    expect(byDate["2026-08-17"]).toBe(RHYTHM_HEAT_SHORT)
    expect(byDate["2026-08-18"]).toBe(RHYTHM_HEAT_SHORT)
    expect(byDate["2026-08-19"]).toBe(RHYTHM_HEAT_SHORT)
    expect(byDate["2026-08-20"]).toBe(RHYTHM_HEAT_REST)

    const hit = encodeRhythmGoalDays(
      [
        { date: "2026-08-17", sessions: 1 },
        { date: "2026-08-18", sessions: 1 },
        { date: "2026-08-19", sessions: 1 },
        { date: "2026-08-20", sessions: 1 },
      ],
      4,
    )
    expect(hit.every((d) => d.value === RHYTHM_HEAT_GOAL)).toBe(true)
  })
})

describe("pierreRhythmSessionDays", () => {
  it("does not build a heatmap series for 7d or 30d", () => {
    expect(rhythmHeatmapRangeDays("7")).toBeNull()
    expect(rhythmHeatmapRangeDays("30")).toBeNull()
    expect(pierreRhythmSessionDays("7")).toEqual([])
  })

  it("marks some 100d weeks as short and others as goal for a 4-day target", () => {
    const days = pierreRhythmSessionDays("100", PROFILE_RHYTHM_END)
    expect(days).toHaveLength(100)
    const encoded = encodeRhythmGoalDays(days, PIERRE_WEEKLY_TARGET)
    expect(encoded.some((d) => d.value === RHYTHM_HEAT_SHORT)).toBe(true)
    expect(encoded.some((d) => d.value === RHYTHM_HEAT_GOAL)).toBe(true)
    expect(encoded.some((d) => d.value === RHYTHM_HEAT_REST)).toBe(true)
  })
})
