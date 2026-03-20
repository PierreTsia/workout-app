import { describe, expect, it } from "vitest"

/**
 * Pure derivation that mirrors the cycleId logic inside startSession.
 * Extracted for testability — the actual startSession function lives in
 * WorkoutPage and has Supabase/atom side effects.
 */
function deriveCycleIdForSession(
  skipCycle: boolean,
  activeCycleId: string | null,
): string | null {
  return skipCycle ? null : (activeCycleId ?? null)
}

describe("deriveCycleIdForSession", () => {
  it("returns the active cycle id for normal sessions", () => {
    expect(deriveCycleIdForSession(false, "cycle-123")).toBe("cycle-123")
  })

  it("returns null when no active cycle exists", () => {
    expect(deriveCycleIdForSession(false, null)).toBeNull()
  })

  it("returns null for quick workouts even when a cycle is active", () => {
    expect(deriveCycleIdForSession(true, "cycle-123")).toBeNull()
  })

  it("returns null for quick workouts when no cycle exists", () => {
    expect(deriveCycleIdForSession(true, null)).toBeNull()
  })
})
