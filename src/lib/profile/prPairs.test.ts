import { describe, expect, it } from "vitest"
import { prPairs } from "./prPairs"
import type { ProfileSnapshot, SessionFact, SetFact } from "./types"

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

function makeSet(overrides: Partial<SetFact> = {}): SetFact {
  return {
    session_id: "s1",
    exercise_id: "ex-plank",
    was_pr: false,
    rir: null,
    weight_logged: 0,
    reps: null,
    duration_seconds: 45,
    block_exercise_id: null,
    ...overrides,
  }
}

const WINDOW = { from: "2026-08-15", to: "2026-08-21", timeZone: "UTC" }

describe("Profil PR pairs", () => {
  it("counts a duration was_pr as one pair, which get_cycle_stats would drop", () => {
    const snapshot: ProfileSnapshot = {
      sessions: [makeSession()],
      sets: [
        makeSet({
          was_pr: true,
          duration_seconds: 60,
          rir: null,
        }),
      ],
    }

    expect(prPairs(snapshot, WINDOW)).toEqual([
      {
        sessionId: "s1",
        exerciseId: "ex-plank",
        finishedAt: "2026-08-20T11:00:00.000Z",
        day: "2026-08-20",
      },
    ])
  })

  it("counts a loaded Circuit station was_pr on the same stream as solos", () => {
    const snapshot: ProfileSnapshot = {
      sessions: [makeSession({ has_catalog_circuit: true })],
      sets: [
        makeSet({
          exercise_id: "ex-deadlift",
          was_pr: true,
          rir: 1,
          weight_logged: 140,
          reps: "5",
          duration_seconds: null,
          block_exercise_id: "station-1",
        }),
      ],
    }

    expect(prPairs(snapshot, WINDOW)).toHaveLength(1)
    expect(prPairs(snapshot, WINDOW)[0]?.exerciseId).toBe("ex-deadlift")
  })

  it("collapses several was_pr sets in one session × exercise to a single pair", () => {
    const snapshot: ProfileSnapshot = {
      sessions: [makeSession()],
      sets: [
        makeSet({ was_pr: true, duration_seconds: 40 }),
        makeSet({ was_pr: true, duration_seconds: 55 }),
      ],
    }

    expect(prPairs(snapshot, WINDOW)).toHaveLength(1)
  })
})
