import { describe, expect, it } from "vitest"
import {
  computeOrphanClose,
  ORPHAN_SESSION_THRESHOLD_MS,
} from "./orphanSessionClose"

// A day after the latest fixture set, so every stale case is > 12 h old.
const NOW = Date.parse("2026-10-01T12:00:00.000Z")
const HOUR = 60 * 60 * 1000

describe("computeOrphanClose", () => {
  it("closes a session whose last set is older than the threshold", () => {
    const close = computeOrphanClose(
      [
        { logged_at: "2026-09-30T06:45:00.000Z" },
        { logged_at: "2026-09-30T07:26:24.643Z" },
      ],
      NOW,
    )

    expect(close).toEqual({
      finishedAt: "2026-09-30T07:26:24.643Z",
      totalSetsDone: 2,
      activeDurationMs: 41 * 60 * 1000 + 24_643,
    })
  })

  it("never uses now() — finished_at is the last set", () => {
    const close = computeOrphanClose(
      [{ logged_at: "2026-09-30T07:26:24.643Z" }],
      NOW,
    )
    expect(close?.finishedAt).toBe("2026-09-30T07:26:24.643Z")
  })

  it("leaves a recent session alone (possibly still in progress)", () => {
    const close = computeOrphanClose(
      [{ logged_at: new Date(NOW - HOUR).toISOString() }],
      NOW,
    )
    expect(close).toBeNull()
  })

  it("treats exactly the threshold as still in progress", () => {
    const close = computeOrphanClose(
      [{ logged_at: new Date(NOW - ORPHAN_SESSION_THRESHOLD_MS).toISOString() }],
      NOW,
    )
    expect(close).toBeNull()
  })

  it("returns null for a session with no sets", () => {
    expect(computeOrphanClose([], NOW)).toBeNull()
  })

  it("returns null when no timestamp is parseable", () => {
    expect(computeOrphanClose([{ logged_at: "not-a-date" }], NOW)).toBeNull()
  })

  it("floors active duration at 0 for a single set", () => {
    const close = computeOrphanClose(
      [{ logged_at: "2026-09-30T07:26:24.643Z" }],
      NOW,
    )
    expect(close?.activeDurationMs).toBe(0)
    expect(close?.totalSetsDone).toBe(1)
  })
})
