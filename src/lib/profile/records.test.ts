import { describe, expect, it } from "vitest"
import { buildRecordsVm } from "./records"
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

const WINDOW = {
  from: "2026-08-15",
  to: "2026-08-21",
  includeDeltas: true,
  timeZone: "UTC",
  grain: "day" as const,
}

describe("Records VM", () => {
  it("increments the PR count for a duration was_pr in the window", () => {
    const snapshot: ProfileSnapshot = {
      sessions: [makeSession()],
      sets: [makeSet({ was_pr: true, duration_seconds: 60 })],
    }

    const vm = buildRecordsVm(snapshot, WINDOW)

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.prs).toBe(1)
    expect(vm.exercises).toBe(1)
    expect(vm.daysSinceLast).toBe(1)
  })

  it("counts a Circuit station PR on the same total as a duration PR", () => {
    const snapshot: ProfileSnapshot = {
      sessions: [makeSession({ has_catalog_circuit: true })],
      sets: [
        makeSet({ was_pr: true, duration_seconds: 60 }),
        makeSet({
          exercise_id: "ex-deadlift",
          was_pr: true,
          rir: 1,
          weight_logged: 140,
          reps: "3",
          duration_seconds: null,
          block_exercise_id: "station-1",
        }),
      ],
    }

    const vm = buildRecordsVm(snapshot, WINDOW)
    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.prs).toBe(2)
    expect(vm.exercises).toBe(2)
  })

  it("hides the RIR line when fewer than two buckets declare a RIR", () => {
    const snapshot: ProfileSnapshot = {
      sessions: [makeSession()],
      sets: [
        makeSet({ was_pr: true, duration_seconds: 60, rir: null }),
        makeSet({
          exercise_id: "ex-squat",
          was_pr: false,
          rir: 0,
          weight_logged: 100,
          reps: "5",
          duration_seconds: null,
        }),
      ],
    }

    const vm = buildRecordsVm(snapshot, WINDOW)
    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.series.rir0.every((rate) => rate == null)).toBe(true)
    expect(vm.series.prs.reduce((sum, n) => sum + n, 0)).toBe(1)
  })

  it("gaps a bucket with no declared RIR instead of plotting 0%", () => {
    const snapshot: ProfileSnapshot = {
      sessions: [
        makeSession({ id: "s-a", finished_at: "2026-08-15T11:00:00.000Z" }),
        makeSession({ id: "s-b", finished_at: "2026-08-16T11:00:00.000Z" }),
        makeSession({ id: "s-c", finished_at: "2026-08-17T11:00:00.000Z" }),
      ],
      sets: [
        makeSet({
          session_id: "s-a",
          exercise_id: "ex-a",
          was_pr: true,
          rir: 0,
          weight_logged: 80,
          reps: "5",
          duration_seconds: null,
        }),
        makeSet({
          session_id: "s-b",
          exercise_id: "ex-b",
          was_pr: true,
          rir: null,
          duration_seconds: 40,
        }),
        makeSet({
          session_id: "s-c",
          exercise_id: "ex-c",
          was_pr: true,
          rir: 0,
          weight_logged: 60,
          reps: "8",
          duration_seconds: null,
        }),
      ],
    }

    const vm = buildRecordsVm(snapshot, WINDOW)
    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.series.rir0).toContain(null)
    expect(vm.series.rir0.some((rate) => rate === 0)).toBe(false)
    expect(vm.series.rir0.filter((rate) => rate != null)).toHaveLength(2)
  })

  it("is empty when the window has sessions but no was_pr pairs", () => {
    const vm = buildRecordsVm(
      {
        sessions: [makeSession()],
        sets: [makeSet({ was_pr: false })],
      },
      WINDOW,
    )
    expect(vm).toEqual({ status: "empty" })
  })

  it("omits vs-prior when includeDeltas is false", () => {
    const vm = buildRecordsVm(
      { sessions: [makeSession()], sets: [makeSet({ was_pr: true })] },
      { ...WINDOW, includeDeltas: false },
    )
    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.prsDelta).toBeNull()
    expect(vm.exercisesDelta).toBeNull()
    expect(vm.daysSinceLastDelta).toBeNull()
  })

  it("keeps 1y month grain at 13 categories or fewer", () => {
    const vm = buildRecordsVm(
      { sessions: [makeSession()], sets: [makeSet({ was_pr: true })] },
      {
        from: "2025-08-22",
        to: "2026-08-21",
        includeDeltas: false,
        timeZone: "UTC",
        grain: "month",
      },
    )
    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.categories.length).toBeLessThanOrEqual(13)
  })
})
