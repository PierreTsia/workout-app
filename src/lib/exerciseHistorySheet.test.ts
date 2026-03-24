import { describe, expect, it } from "vitest"
import {
  parseExerciseHistorySheetPayload,
  setEstimated1RmKg,
  trendBestDurationSecondsPerSessionOldestFirst,
  trendBestE1RmKgPerSessionOldestFirst,
} from "./exerciseHistorySheet"

describe("parseExerciseHistorySheetPayload", () => {
  it("parses valid RPC array", () => {
    const raw = [
      {
        session_id: "s1",
        finished_at: "2025-01-01T00:00:00.000Z",
        sets: [
          {
            id: "l1",
            set_number: 1,
            reps_logged: "10",
            weight_logged: 40,
            rir: 2,
            estimated_1rm: 50,
          },
        ],
      },
    ]
    const out = parseExerciseHistorySheetPayload(raw)
    expect(out).toHaveLength(1)
    expect(out[0].session_id).toBe("s1")
    expect(out[0].sets[0].weight_logged).toBe(40)
  })

  it("returns empty for non-array", () => {
    expect(parseExerciseHistorySheetPayload(null)).toEqual([])
    expect(parseExerciseHistorySheetPayload({})).toEqual([])
  })
})

describe("setEstimated1RmKg", () => {
  it("uses stored estimated_1rm when present", () => {
    const set = {
      id: "1",
      set_number: 1,
      reps_logged: "10",
      weight_logged: 40,
      rir: null,
      estimated_1rm: 55.5,
    }
    expect(setEstimated1RmKg(set)).toBe(55.5)
  })

  it("computes Epley when estimated_1rm is null", () => {
    const set = {
      id: "1",
      set_number: 1,
      reps_logged: "10",
      weight_logged: 100,
      rir: null,
      estimated_1rm: null,
    }
    // 100 * (1 + 10/30) = 133.33...
    expect(setEstimated1RmKg(set)).toBeCloseTo(133.33, 1)
  })
})

describe("trendBestE1RmKgPerSessionOldestFirst", () => {
  it("reverses to chronological and takes best e1rm per session", () => {
    const sessions = [
      {
        session_id: "new",
        finished_at: "2025-02-01T00:00:00.000Z",
        sets: [
          { id: "a", set_number: 1, reps_logged: "5", weight_logged: 100, rir: 1, estimated_1rm: null },
        ],
      },
      {
        session_id: "old",
        finished_at: "2025-01-01T00:00:00.000Z",
        sets: [
          { id: "b", set_number: 1, reps_logged: "10", weight_logged: 100, rir: 2, estimated_1rm: null },
        ],
      },
    ]
    // Same max weight 100 kg, but 10 reps → higher Epley 1RM than 5 reps
    const eOld = setEstimated1RmKg(sessions[1].sets[0])
    const eNew = setEstimated1RmKg(sessions[0].sets[0])
    expect(eOld).toBeGreaterThan(eNew)
    expect(trendBestE1RmKgPerSessionOldestFirst(sessions)).toEqual([eOld, eNew])
  })
})

describe("trendBestDurationSecondsPerSessionOldestFirst", () => {
  it("reverses to chronological and takes longest hold per session", () => {
    const sessions = [
      {
        session_id: "new",
        finished_at: "2025-02-01T00:00:00.000Z",
        sets: [
          {
            id: "a",
            set_number: 1,
            reps_logged: null,
            duration_seconds: 20,
            weight_logged: 0,
            rir: null,
            estimated_1rm: null,
          },
        ],
      },
      {
        session_id: "old",
        finished_at: "2025-01-01T00:00:00.000Z",
        sets: [
          {
            id: "b",
            set_number: 1,
            reps_logged: null,
            duration_seconds: 45,
            weight_logged: 0,
            rir: null,
            estimated_1rm: null,
          },
          {
            id: "c",
            set_number: 2,
            reps_logged: null,
            duration_seconds: 30,
            weight_logged: 0,
            rir: null,
            estimated_1rm: null,
          },
        ],
      },
    ]
    expect(trendBestDurationSecondsPerSessionOldestFirst(sessions)).toEqual([45, 20])
  })
})
