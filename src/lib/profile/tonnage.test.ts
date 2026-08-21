import { describe, expect, it } from "vitest"
import { buildTonnageVm } from "./tonnage"
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
    exercise_id: "ex-1",
    was_pr: false,
    rir: 2,
    weight_logged: 0,
    reps: "10",
    duration_seconds: null,
    block_exercise_id: null,
    ...overrides,
  }
}

function snapshot(sessions: SessionFact[], sets: SetFact[]): ProfileSnapshot {
  return { sessions, sets }
}

const WINDOW = {
  kind: "7" as const,
  from: "2026-08-15",
  to: "2026-08-21",
  includeDeltas: true,
  timeZone: "UTC",
}

describe("buildTonnageVm", () => {
  it("counts a loaded Circuit station and ignores Cindy 0 kg and duration holds", () => {
    const cindy = makeSession({
      id: "cindy",
      finished_at: "2026-08-21T10:00:00.000Z",
      has_catalog_circuit: true,
    })
    const iron = makeSession({
      id: "iron",
      finished_at: "2026-08-20T11:00:00.000Z",
      has_catalog_circuit: true,
    })

    const vm = buildTonnageVm(
      snapshot(
        [cindy, iron],
        [
          makeSet({
            session_id: "cindy",
            exercise_id: "pullup",
            weight_logged: 0,
            reps: "15",
            block_exercise_id: "be-cindy",
          }),
          makeSet({
            session_id: "cindy",
            exercise_id: "plank",
            weight_logged: 20,
            reps: null,
            duration_seconds: 60,
            block_exercise_id: "be-plank",
          }),
          makeSet({
            session_id: "iron",
            exercise_id: "deadlift",
            weight_logged: 140,
            reps: "3",
            block_exercise_id: "be-dl",
          }),
        ],
      ),
      WINDOW,
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.tonnes).toBe(0.42)
    expect(vm.tonnes).not.toBe(0)
  })

  it("is empty when the window only has Cindy 0 kg sets", () => {
    const vm = buildTonnageVm(
      snapshot(
        [
          makeSession({
            id: "cindy",
            finished_at: "2026-08-21T10:00:00.000Z",
            has_catalog_circuit: true,
          }),
        ],
        [
          makeSet({
            session_id: "cindy",
            weight_logged: 0,
            reps: "15",
            block_exercise_id: "be-cindy",
          }),
        ],
      ),
      WINDOW,
    )

    expect(vm).toEqual({ status: "empty" })
  })

  it("omits vs-prior when includeDeltas is false and subtracts the prior window otherwise", () => {
    const current = makeSession({
      id: "now",
      finished_at: "2026-08-20T11:00:00.000Z",
    })
    const prior = makeSession({
      id: "then",
      started_at: "2026-08-10T10:00:00.000Z",
      finished_at: "2026-08-10T11:00:00.000Z",
    })
    const snap = snapshot(
      [current, prior],
      [
        makeSet({ session_id: "now", weight_logged: 100, reps: "10" }),
        makeSet({ session_id: "then", weight_logged: 80, reps: "5" }),
      ],
    )

    const withDelta = buildTonnageVm(snap, WINDOW)
    expect(withDelta.status).toBe("ok")
    if (withDelta.status !== "ok") return
    expect(withDelta.tonnes).toBe(1)
    expect(withDelta.deltaTonnes).toBe(0.6)

    const always = buildTonnageVm(snap, { ...WINDOW, includeDeltas: false })
    expect(always.status).toBe("ok")
    if (always.status !== "ok") return
    expect(always.deltaTonnes).toBeNull()
  })

  it("buckets loaded tonnes onto the Mix day grain, not a radar kg sum", () => {
    const vm = buildTonnageVm(
      snapshot(
        [makeSession({ id: "iron", finished_at: "2026-08-20T11:00:00.000Z" })],
        [
          makeSet({
            session_id: "iron",
            weight_logged: 140,
            reps: "3",
            block_exercise_id: "be-dl",
          }),
        ],
      ),
      WINDOW,
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.bars).toHaveLength(7)
    expect(vm.bars[5]).toBe(0.42)
    expect(vm.bars.reduce((sum, t) => sum + t, 0)).toBe(0.42)
  })
})
