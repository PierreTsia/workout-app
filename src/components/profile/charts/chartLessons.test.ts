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
  it("lists Mix session counts, rest when empty", () => {
    expect(mixLesson({ programme: 0, quickWorkout: 0, circuits: 0 }, t)).toBe(
      "mix.tooltip.rest",
    )
    expect(mixLesson({ programme: 2, quickWorkout: 1, circuits: 0 }, t)).toBe(
      'mix.tooltip.slice:{"n":2,"slice":"mix.slice.programme:{\\"count\\":2}"} · mix.tooltip.slice:{"n":1,"slice":"mix.slice.quickWorkout:{\\"count\\":1}"}',
    )
    expect(mixLesson({ programme: 0, quickWorkout: 0, circuits: 1 }, t)).toBe(
      'mix.tooltip.slice:{"n":1,"slice":"mix.slice.circuits:{\\"count\\":1}"}',
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
