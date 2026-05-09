import { describe, expect, it } from "vitest"
import { shouldCloseCycleOnSessionFinish } from "./cycleCompletion"

describe("shouldCloseCycleOnSessionFinish", () => {
  it("returns true when cached cycle sessions complete the cycle even if hook progress is stale", () => {
    expect(
      shouldCloseCycleOnSessionFinish({
        cycleId: "cycle-1",
        totalDays: 3,
        completedDayIds: [],
        activeSessionDayId: "day-3",
        cycleSessionsFromCache: [
          { workout_day_id: "day-1" },
          { workout_day_id: "day-2" },
        ],
      }),
    ).toBe(true)
  })

  it("returns false when no cycle is attached", () => {
    expect(
      shouldCloseCycleOnSessionFinish({
        cycleId: null,
        totalDays: 3,
        completedDayIds: ["day-1", "day-2"],
        activeSessionDayId: "day-3",
      }),
    ).toBe(false)
  })

  it("returns false when cycle still has missing days", () => {
    expect(
      shouldCloseCycleOnSessionFinish({
        cycleId: "cycle-1",
        totalDays: 4,
        completedDayIds: ["day-1", "day-2"],
        activeSessionDayId: "day-3",
      }),
    ).toBe(false)
  })
})
