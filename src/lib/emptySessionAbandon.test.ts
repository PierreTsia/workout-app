import { describe, it, expect } from "vitest"
import { canAbandonEmptySession } from "./emptySessionAbandon"

describe("canAbandonEmptySession (#654)", () => {
  it("allows abandon when no real session exists yet", () => {
    expect(canAbandonEmptySession(null, false)).toBe(true)
  })

  it("allows abandon once the session's set_logs loaded successfully", () => {
    expect(canAbandonEmptySession("real-1", true)).toBe(true)
  })

  it("refuses abandon while the logs are loading or after a failed fetch", () => {
    // Caller passes the *success* signal, so both loading and error arrive as
    // false — a real session with unknown server state must confirm, never
    // delete. (The isSuccess-vs-isFetched wiring is pinned by the WorkoutPage test.)
    expect(canAbandonEmptySession("real-1", false)).toBe(false)
  })
})
