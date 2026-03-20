import { describe, expect, it } from "vitest"

import type { WorkoutDay } from "@/types/database"

/**
 * Pure derivation logic extracted for testability.
 * Mirrors the useMemo inside useCycleProgress.
 */
function deriveCycleProgress(
  cycleSessions: { workout_day_id: string | null }[] | undefined,
  days: WorkoutDay[],
) {
  const completedSet = new Set(
    cycleSessions
      ?.map((s) => s.workout_day_id)
      .filter((id): id is string => id != null) ?? [],
  )
  const totalDays = days.length
  const nextDayId = days.find((d) => !completedSet.has(d.id))?.id ?? null
  return {
    completedDayIds: [...completedSet],
    totalDays,
    nextDayId,
    isComplete: totalDays > 0 && completedSet.size >= totalDays,
  }
}

const makeDays = (ids: string[]): WorkoutDay[] =>
  ids.map((id, i) => ({
    id,
    user_id: "u1",
    program_id: "p1",
    label: `Day ${i + 1}`,
    emoji: "💪",
    sort_order: i,
    created_at: "2026-01-01T00:00:00.000Z",
  }))

describe("deriveCycleProgress", () => {
  it("returns empty progress when no sessions exist", () => {
    const result = deriveCycleProgress(undefined, makeDays(["d1", "d2", "d3"]))
    expect(result.completedDayIds).toEqual([])
    expect(result.totalDays).toBe(3)
    expect(result.nextDayId).toBe("d1")
    expect(result.isComplete).toBe(false)
  })

  it("marks completed days and finds next", () => {
    const sessions = [
      { workout_day_id: "d1" },
      { workout_day_id: "d2" },
    ]
    const result = deriveCycleProgress(sessions, makeDays(["d1", "d2", "d3"]))
    expect(result.completedDayIds).toContain("d1")
    expect(result.completedDayIds).toContain("d2")
    expect(result.completedDayIds).not.toContain("d3")
    expect(result.nextDayId).toBe("d3")
    expect(result.isComplete).toBe(false)
  })

  it("detects cycle completion", () => {
    const sessions = [
      { workout_day_id: "d1" },
      { workout_day_id: "d2" },
    ]
    const result = deriveCycleProgress(sessions, makeDays(["d1", "d2"]))
    expect(result.isComplete).toBe(true)
    expect(result.nextDayId).toBeNull()
  })

  it("handles duplicate sessions for same day", () => {
    const sessions = [
      { workout_day_id: "d1" },
      { workout_day_id: "d1" },
    ]
    const result = deriveCycleProgress(sessions, makeDays(["d1", "d2"]))
    expect(result.completedDayIds).toEqual(["d1"])
    expect(result.nextDayId).toBe("d2")
    expect(result.isComplete).toBe(false)
  })

  it("ignores sessions with null workout_day_id", () => {
    const sessions = [
      { workout_day_id: null },
      { workout_day_id: "d1" },
    ]
    const result = deriveCycleProgress(sessions, makeDays(["d1", "d2"]))
    expect(result.completedDayIds).toEqual(["d1"])
    expect(result.isComplete).toBe(false)
  })

  it("returns isComplete false when days array is empty", () => {
    const result = deriveCycleProgress([], [])
    expect(result.isComplete).toBe(false)
    expect(result.nextDayId).toBeNull()
  })
})
