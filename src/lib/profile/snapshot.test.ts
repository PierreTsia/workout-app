import { describe, expect, it } from "vitest"
import { parseProfileSnapshot } from "./snapshot"
import type { ProfileSnapshot } from "./types"

const RAW: ProfileSnapshot = {
  sessions: [
    {
      id: "sess-1",
      started_at: "2026-08-20T10:00:00.000Z",
      finished_at: "2026-08-20T11:00:00.000Z",
      active_duration_ms: 40 * 60_000,
      program_id: "prog-1",
      has_catalog_circuit: true,
    },
    {
      id: "sess-2",
      started_at: "2026-08-19T08:00:00.000Z",
      finished_at: "2026-08-19T09:10:00.000Z",
      active_duration_ms: null,
      program_id: null,
      has_catalog_circuit: false,
    },
  ],
  sets: [
    {
      session_id: "sess-1",
      exercise_id: "ex-1",
      was_pr: true,
      rir: 0,
      weight_logged: 80,
      reps: "5",
      duration_seconds: null,
      block_exercise_id: null,
    },
  ],
}

describe("parseProfileSnapshot", () => {
  it("keeps session facts including nullable program_id and catalog-circuit flag", () => {
    expect(parseProfileSnapshot(RAW)).toEqual(RAW)
  })

  it("accepts the listed set columns only", () => {
    const parsed = parseProfileSnapshot(RAW)
    expect(parsed.sets).toEqual(RAW.sets)
    expect(Object.keys(parsed.sets[0] ?? {}).sort()).toEqual(
      [
        "block_exercise_id",
        "duration_seconds",
        "exercise_id",
        "reps",
        "rir",
        "session_id",
        "was_pr",
        "weight_logged",
      ].sort(),
    )
  })
})
