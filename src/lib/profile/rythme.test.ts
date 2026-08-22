import { describe, expect, it } from "vitest"
import { buildRhythmVm } from "./rythme"
import type { ProfileSnapshot, SessionFact } from "./types"
import type { ProfileWindowKind } from "./window"

type BoundedKind = Exclude<ProfileWindowKind, "all">

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

const WEEK: {
  kind: BoundedKind
  from: string
  to: string
  timeZone: string
} = {
  kind: "7",
  from: "2026-08-15",
  to: "2026-08-21",
  timeZone: "UTC",
}

describe("buildRhythmVm", () => {
  it("keeps empty rings when the window has no sessions", () => {
    const vm = buildRhythmVm(snapshot([]), WEEK)

    expect(vm.categories).toHaveLength(7)
    expect(vm.hits).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it("counts a trained day once even when two sessions land on it", () => {
    const vm = buildRhythmVm(
      snapshot([
        makeSession({ id: "am", finished_at: "2026-08-20T11:00:00.000Z" }),
        makeSession({ id: "pm", finished_at: "2026-08-20T18:00:00.000Z" }),
      ]),
      WEEK,
    )

    expect(vm.hits.reduce((sum, n) => sum + n, 0)).toBe(1)
  })

  it("plots 1y Rhythm as days per week, not raw days in the month", () => {
    const january = Array.from({ length: 16 }, (_, i) => {
      const day = i + 1
      const isoDay = day < 10 ? `2026-01-0${day}` : `2026-01-${day}`
      return makeSession({
        id: isoDay,
        started_at: `${isoDay}T10:00:00.000Z`,
        finished_at: `${isoDay}T11:00:00.000Z`,
      })
    })
    const vm = buildRhythmVm(snapshot(january), {
      kind: "365",
      from: "2025-08-22",
      to: "2026-08-21",
      timeZone: "UTC",
    })

    const janIndex = vm.categories.findIndex((key) => key === "2026-01")
    expect(janIndex).toBeGreaterThanOrEqual(0)
    expect(vm.hits[janIndex]).toBe(4)
    expect(vm.hits[janIndex]).toBeLessThanOrEqual(7)
  })
})
