import { describe, it, expect } from "vitest"
import { canAbandonEmptySession } from "./emptySessionAbandon"

describe("canAbandonEmptySession (#654)", () => {
  it("allows abandon when no real session exists yet", () => {
    expect(canAbandonEmptySession(null, false)).toBe(true)
  })

  it("allows abandon once the session's set_logs loaded successfully", () => {
    expect(canAbandonEmptySession("real-1", true)).toBe(true)
  })

  it("refuses abandon while the logs are still loading", () => {
    expect(canAbandonEmptySession("real-1", false)).toBe(false)
  })

  it("refuses abandon after a failed logs fetch — unknown state must confirm", () => {
    // `isFetched` is true after an error too; the gate must use success, not
    // fetched, or a Finish tap deletes a real session on a transient 5xx.
    expect(canAbandonEmptySession("real-1", false)).toBe(false)
  })
})
