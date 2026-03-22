import { describe, expect, it } from "vitest"
import { buildDenseTrainingDays } from "./trainingActivityBuckets"
import type { TrainingDayBucketRow } from "@/types/history"

describe("buildDenseTrainingDays", () => {
  it("fills gaps with zeros", () => {
    const sparse: TrainingDayBucketRow[] = [
      { day: "2026-03-20", session_count: 2, minutes: 90 },
      { day: "2026-03-22", session_count: 1, minutes: 45 },
    ]
    const dense = buildDenseTrainingDays(sparse, "2026-03-20", "2026-03-22")
    expect(dense).toEqual([
      { date: "2026-03-20", session_count: 2, minutes: 90 },
      { date: "2026-03-21", session_count: 0, minutes: 0 },
      { date: "2026-03-22", session_count: 1, minutes: 45 },
    ])
  })

  it("returns empty for inverted range", () => {
    expect(buildDenseTrainingDays([], "2026-03-22", "2026-03-20")).toEqual([])
  })

  it("handles single day", () => {
    const dense = buildDenseTrainingDays([], "2026-01-15", "2026-01-15")
    expect(dense).toEqual([{ date: "2026-01-15", session_count: 0, minutes: 0 }])
  })
})
