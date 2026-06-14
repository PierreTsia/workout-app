import { describe, it, expect } from "vitest"
import { buildExerciseTrendSeries } from "./exerciseTrend"
import type { SetLog } from "@/types/database"

let logIdCounter = 0

function makeLog(overrides: Partial<SetLog> = {}): SetLog {
  logIdCounter += 1
  return {
    id: `log-${logIdCounter}`,
    session_id: "session-1",
    exercise_id: "exercise-1",
    block_exercise_id: null,
    exercise_name_snapshot: "Bench Press",
    set_number: 1,
    reps_logged: "8",
    duration_seconds: null,
    weight_logged: 40,
    estimated_1rm: null,
    was_pr: false,
    logged_at: "2026-05-01T10:00:00Z",
    rir: null,
    rest_seconds: null,
    ...overrides,
  }
}

describe("buildExerciseTrendSeries — trend semantics", () => {
  it("does not surface false progression when day-2 has one peak set followed by collapses (8/8/8 → 10/4/4 @ 40 kg)", () => {
    const day1 = "2026-05-01T10:00:00Z"
    const day2 = "2026-05-02T10:00:00Z"

    const logs: SetLog[] = [
      makeLog({ logged_at: day1, reps_logged: "8" }),
      makeLog({ logged_at: day1, reps_logged: "8" }),
      makeLog({ logged_at: day1, reps_logged: "8" }),
      makeLog({ logged_at: day2, reps_logged: "10" }),
      makeLog({ logged_at: day2, reps_logged: "4" }),
      makeLog({ logged_at: day2, reps_logged: "4" }),
    ]

    const series = buildExerciseTrendSeries(logs, "e1rm")

    const endOfDay1 = series.trend[2].value
    const endOfDay2 = series.trend[5].value

    expect(endOfDay2).toBeLessThanOrEqual(endOfDay1)
  })

  it("excludes e1rm points whose reps_logged is missing and no estimated_1rm is provided", () => {
    const logs: SetLog[] = [
      makeLog({ logged_at: "2026-05-01T10:00:00Z", reps_logged: "8", weight_logged: 40 }),
      makeLog({
        logged_at: "2026-05-02T10:00:00Z",
        reps_logged: null,
        weight_logged: 40,
        estimated_1rm: null,
      }),
      makeLog({ logged_at: "2026-05-03T10:00:00Z", reps_logged: "10", weight_logged: 40 }),
    ]

    const series = buildExerciseTrendSeries(logs, "e1rm")

    expect(series.scatter).toHaveLength(2)
    expect(series.scatter.every((p) => p.value > 0)).toBe(true)
  })

  it("smooths the trend as a rolling mean of the configured window over set values", () => {
    const logs: SetLog[] = [10, 20, 30, 40, 50].map((e1rm, i) =>
      makeLog({
        logged_at: `2026-05-0${i + 1}T10:00:00Z`,
        estimated_1rm: e1rm,
      }),
    )

    const series = buildExerciseTrendSeries(logs, "e1rm", { window: 3 })

    expect(series.trend.map((p) => p.value)).toEqual([10, 15, 20, 30, 40])
  })
})

describe("buildExerciseTrendSeries — reps variant", () => {
  it("uses parsed reps_logged as the value and excludes logs with non-numeric reps", () => {
    const logs: SetLog[] = [
      makeLog({ logged_at: "2026-05-01T10:00:00Z", reps_logged: "8" }),
      makeLog({ logged_at: "2026-05-02T10:00:00Z", reps_logged: "10" }),
      makeLog({ logged_at: "2026-05-03T10:00:00Z", reps_logged: null }),
      makeLog({ logged_at: "2026-05-04T10:00:00Z", reps_logged: "12" }),
    ]

    const series = buildExerciseTrendSeries(logs, "reps", { window: 2 })

    expect(series.scatter.map((p) => p.value)).toEqual([8, 10, 12])
    expect(series.trend.map((p) => p.value)).toEqual([8, 9, 11])
  })
})

describe("buildExerciseTrendSeries — duration variant", () => {
  it("uses duration_seconds as the value and excludes logs without a duration", () => {
    const logs: SetLog[] = [
      makeLog({ logged_at: "2026-05-01T10:00:00Z", duration_seconds: 30 }),
      makeLog({ logged_at: "2026-05-02T10:00:00Z", duration_seconds: null }),
      makeLog({ logged_at: "2026-05-03T10:00:00Z", duration_seconds: 45 }),
      makeLog({ logged_at: "2026-05-04T10:00:00Z", duration_seconds: 60 }),
    ]

    const series = buildExerciseTrendSeries(logs, "duration", { window: 2 })

    expect(series.scatter.map((p) => p.value)).toEqual([30, 45, 60])
    expect(series.trend.map((p) => p.value)).toEqual([30, 37.5, 52.5])
  })
})
