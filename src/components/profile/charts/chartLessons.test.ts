import { describe, expect, it } from "vitest"
import {
  mixLesson,
  radarLesson,
  recordsLesson,
  rhythmLesson,
} from "./chartLessons"

function t(key: string, opts?: Record<string, string | number>): string {
  if (opts == null) return key
  return `${key}:${JSON.stringify(opts)}`
}

describe("chartLessons", () => {
  it("explains Mix by the winning slice, rest when empty", () => {
    expect(mixLesson({ programme: 0, quickWorkout: 0, circuits: 0 }, t)).toBe(
      "mix.tooltip.rest",
    )
    expect(mixLesson({ programme: 20, quickWorkout: 10, circuits: 70 }, t)).toBe(
      "mix.tooltip.circuits",
    )
    expect(mixLesson({ programme: 10, quickWorkout: 80, circuits: 10 }, t)).toBe(
      "mix.tooltip.quickWorkout",
    )
    expect(mixLesson({ programme: 60, quickWorkout: 20, circuits: 20 }, t)).toBe(
      "mix.tooltip.programme",
    )
  })

  it("explains Rhythm against the weekly target", () => {
    expect(rhythmLesson(0, 4, t)).toBe("rhythm.tooltip.empty")
    expect(rhythmLesson(2, 4, t)).toContain("rhythm.tooltip.short")
    expect(rhythmLesson(4, 4, t)).toContain("rhythm.tooltip.onTarget")
    expect(rhythmLesson(6, 4, t)).toContain("rhythm.tooltip.over")
  })

  it("keeps a Records grinders gap honest when RIR is missing", () => {
    expect(recordsLesson({ prs: 1, rir0: null }, t)).toContain(
      "records.tooltip.noRir",
    )
    expect(recordsLesson({ prs: 2, rir0: 22 }, t)).toContain(
      "records.tooltip.combo",
    )
  })

  it("reads radar credits as sets, not the 0–1 fixture", () => {
    expect(radarLesson({ muscle: "Pectoraux", current: 0.9 }, t)).toContain(
      '"sets":18',
    )
    expect(
      radarLesson({ muscle: "Pectoraux", current: 0.9, prior: 0.8 }, t),
    ).toContain("balance.tooltip.up")
  })
})
