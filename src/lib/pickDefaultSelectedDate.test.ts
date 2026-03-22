import { describe, expect, it } from "vitest"
import { pickDefaultSelectedDate } from "@/lib/pickDefaultSelectedDate"
import type { TrainingDayBucketRow } from "@/types/history"

describe("pickDefaultSelectedDate", () => {
  const march2024 = new Date(2024, 2, 1)

  it("picks the last day in the month that has sessions (B)", () => {
    const sparse: TrainingDayBucketRow[] = [
      { day: "2024-03-05", session_count: 1, minutes: 30 },
      { day: "2024-03-20", session_count: 2, minutes: 90 },
    ]
    const got = pickDefaultSelectedDate(march2024, sparse, new Date(2024, 2, 10))
    expect(got.getFullYear()).toBe(2024)
    expect(got.getMonth()).toBe(2)
    expect(got.getDate()).toBe(20)
  })

  it("when no sessions, uses today if today is in the visible month", () => {
    const today = new Date(2024, 2, 12, 15, 30, 0)
    const got = pickDefaultSelectedDate(march2024, [], today)
    expect(got.getFullYear()).toBe(2024)
    expect(got.getMonth()).toBe(2)
    expect(got.getDate()).toBe(12)
  })

  it("when no sessions and today not in month, uses first of month", () => {
    const today = new Date(2024, 4, 12)
    const got = pickDefaultSelectedDate(march2024, [], today)
    expect(got.getFullYear()).toBe(2024)
    expect(got.getMonth()).toBe(2)
    expect(got.getDate()).toBe(1)
  })

  it("ignores zero-session rows when picking last trained day", () => {
    const sparse: TrainingDayBucketRow[] = [
      { day: "2024-03-10", session_count: 0, minutes: 0 },
      { day: "2024-03-11", session_count: 1, minutes: 10 },
    ]
    const got = pickDefaultSelectedDate(march2024, sparse, new Date(2024, 2, 1))
    expect(got.getDate()).toBe(11)
  })
})
