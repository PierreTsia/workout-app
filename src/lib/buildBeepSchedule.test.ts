import { describe, it, expect } from "vitest"
import { buildBeepSchedule } from "./buildBeepSchedule"

describe("buildBeepSchedule", () => {
  it("schedules three pre-end warnings and a finish for a long target", () => {
    const schedule = buildBeepSchedule(10)

    expect(schedule).toEqual([
      { atMsFromStart: 7_000, kind: "warning" },
      { atMsFromStart: 8_000, kind: "warning" },
      { atMsFromStart: 9_000, kind: "warning" },
      { atMsFromStart: 10_000, kind: "finish" },
    ])
  })

  it("clamps pre-end warnings that would coincide with the start", () => {
    expect(buildBeepSchedule(3)).toEqual([
      { atMsFromStart: 1_000, kind: "warning" },
      { atMsFromStart: 2_000, kind: "warning" },
      { atMsFromStart: 3_000, kind: "finish" },
    ])

    expect(buildBeepSchedule(2)).toEqual([
      { atMsFromStart: 1_000, kind: "warning" },
      { atMsFromStart: 2_000, kind: "finish" },
    ])

    expect(buildBeepSchedule(1)).toEqual([
      { atMsFromStart: 1_000, kind: "finish" },
    ])
  })

  it("returns an empty schedule for non-positive targets", () => {
    expect(buildBeepSchedule(0)).toEqual([])
    expect(buildBeepSchedule(-5)).toEqual([])
  })
})
