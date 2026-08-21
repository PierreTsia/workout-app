import { describe, expect, it } from "vitest"
import { hopOtherProgramId, hopOtherProgramIdFromIds } from "./hop"
import type { SessionFact } from "./types"

function makeSession(overrides: Partial<SessionFact> = {}): SessionFact {
  return {
    id: "s1",
    started_at: "2026-08-20T10:00:00.000Z",
    finished_at: "2026-08-20T11:00:00.000Z",
    active_duration_ms: 40 * 60_000,
    program_id: null,
    has_catalog_circuit: false,
    ...overrides,
  }
}

const WINDOW = {
  from: "2026-08-15",
  to: "2026-08-21",
  timeZone: "UTC",
}

describe("hopOtherProgramId", () => {
  it("hides the hop line when the window is one Program plus Quick Workout", () => {
    expect(
      hopOtherProgramId(
        [
          makeSession({ id: "prog", program_id: "upper-lower" }),
          makeSession({
            id: "qw",
            program_id: null,
            finished_at: "2026-08-19T11:00:00.000Z",
          }),
        ],
        WINDOW,
        "upper-lower",
      ),
    ).toBeNull()
  })

  it("returns the other Program when two distinct program_id values sit in the window", () => {
    expect(
      hopOtherProgramId(
        [
          makeSession({ id: "ul", program_id: "upper-lower" }),
          makeSession({
            id: "ppl",
            program_id: "ppl",
            finished_at: "2026-08-18T11:00:00.000Z",
          }),
        ],
        WINDOW,
        "upper-lower",
      ),
    ).toBe("ppl")
  })

  it("ignores a second Program that finished outside this window", () => {
    expect(
      hopOtherProgramId(
        [
          makeSession({ id: "ul", program_id: "upper-lower" }),
          makeSession({
            id: "ppl",
            program_id: "ppl",
            finished_at: "2026-07-01T11:00:00.000Z",
          }),
        ],
        WINDOW,
        "upper-lower",
      ),
    ).toBeNull()
  })
})

describe("hopOtherProgramIdFromIds", () => {
  it("treats career program_ids as the All time window", () => {
    expect(hopOtherProgramIdFromIds(["upper-lower"], "upper-lower")).toBeNull()
    expect(hopOtherProgramIdFromIds(["upper-lower", null], "upper-lower")).toBeNull()
    expect(hopOtherProgramIdFromIds(["upper-lower", "ppl"], "upper-lower")).toBe(
      "ppl",
    )
  })
})
