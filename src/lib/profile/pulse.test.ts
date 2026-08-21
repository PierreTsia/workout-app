import { describe, expect, it } from "vitest"
import { buildPulseVm, formatPulseDuration, sessionDurationMs } from "./pulse"
import type { ProfileSnapshot, SessionFact } from "./types"

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

function snapshot(sessions: SessionFact[]): ProfileSnapshot {
  return { sessions, sets: [] }
}

const WINDOW = {
  from: "2026-08-15",
  to: "2026-08-21",
  includeDeltas: true,
  timeZone: "UTC",
  prescribedMinutes: 60,
}

describe("session time", () => {
  it("falls back to wall clock when active_duration_ms is null", () => {
    expect(
      sessionDurationMs(
        makeSession({
          started_at: "2026-08-20T10:00:00.000Z",
          finished_at: "2026-08-20T11:05:00.000Z",
          active_duration_ms: null,
        }),
      ),
    ).toBe(65 * 60_000)
  })

  it("prefers active_duration_ms over a longer wall clock (pauses excluded)", () => {
    expect(
      sessionDurationMs(
        makeSession({
          started_at: "2026-08-20T10:00:00.000Z",
          finished_at: "2026-08-20T12:00:00.000Z",
          active_duration_ms: 40 * 60_000,
        }),
      ),
    ).toBe(40 * 60_000)
  })
})

describe("buildPulseVm", () => {
  it("marks the whole strip empty when the window has no sessions", () => {
    const vm = buildPulseVm(snapshot([]), WINDOW)

    expect(vm).toEqual({ status: "empty" })
  })

  it("sums session time with wall-clock fallback and deltas vs the prior window", () => {
    const vm = buildPulseVm(
      snapshot([
        makeSession({
          id: "current-active",
          started_at: "2026-08-20T10:00:00.000Z",
          finished_at: "2026-08-20T12:00:00.000Z",
          active_duration_ms: 40 * 60_000,
        }),
        makeSession({
          id: "current-fallback",
          started_at: "2026-08-19T10:00:00.000Z",
          finished_at: "2026-08-19T11:00:00.000Z",
          active_duration_ms: null,
        }),
        makeSession({
          id: "prior",
          started_at: "2026-08-10T10:00:00.000Z",
          finished_at: "2026-08-10T11:00:00.000Z",
          active_duration_ms: 50 * 60_000,
        }),
        makeSession({
          id: "outside",
          started_at: "2026-07-01T10:00:00.000Z",
          finished_at: "2026-07-01T11:00:00.000Z",
          active_duration_ms: 90 * 60_000,
        }),
      ]),
      WINDOW,
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.sessions).toBe(2)
    expect(vm.sessionDelta).toBe(1)
    expect(vm.durationMs).toBe(100 * 60_000)
    expect(vm.durationDeltaMs).toBe(50 * 60_000)
    expect(vm.avgMinutes).toBe(50)
    expect(vm.prescribedMinutes).toBe(60)
  })

  it("omits vs-prior deltas when includeDeltas is false", () => {
    const vm = buildPulseVm(snapshot([makeSession()]), {
      ...WINDOW,
      includeDeltas: false,
    })

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.sessionDelta).toBeNull()
    expect(vm.durationDeltaMs).toBeNull()
  })
})

describe("formatPulseDuration", () => {
  it("renders session time like the pulse strip, not activity-by-day minutes", () => {
    expect(formatPulseDuration(40 * 60_000)).toBe("40 min")
    expect(formatPulseDuration(200 * 60_000)).toBe("3h 20")
    expect(formatPulseDuration(60 * 60_000)).toBe("1h")
  })
})
