import { describe, expect, it } from "vitest"
import { buildMixVm, MIX_SLICE_VECTORS, mixSlice } from "./mixSlice"
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

describe("mixSlice", () => {
  it.each(MIX_SLICE_VECTORS)(
    "labels $name as $expected",
    ({ has_catalog_circuit, program_id, expected }) => {
      expect(mixSlice({ has_catalog_circuit, program_id })).toBe(expected)
    },
  )
})

describe("buildMixVm", () => {
  it("marks Mix empty when the window has no sessions", () => {
    expect(buildMixVm(snapshot([]), WEEK)).toEqual({ status: "empty" })
  })

  it("stacks QW, Programme, and a catalog Circuit as three Mix slices in one week", () => {
    const vm = buildMixVm(
      snapshot([
        makeSession({
          id: "cindy",
          started_at: "2026-08-17T10:00:00.000Z",
          finished_at: "2026-08-17T11:00:00.000Z",
          program_id: "upper-lower",
          has_catalog_circuit: true,
        }),
        makeSession({
          id: "qw",
          started_at: "2026-08-19T10:00:00.000Z",
          finished_at: "2026-08-19T11:00:00.000Z",
          program_id: null,
          has_catalog_circuit: false,
        }),
        makeSession({
          id: "program",
          started_at: "2026-08-21T10:00:00.000Z",
          finished_at: "2026-08-21T11:00:00.000Z",
          program_id: "upper-lower",
          has_catalog_circuit: false,
        }),
        makeSession({
          id: "outside",
          started_at: "2026-08-01T10:00:00.000Z",
          finished_at: "2026-08-01T11:00:00.000Z",
          program_id: "upper-lower",
          has_catalog_circuit: false,
        }),
      ]),
      WEEK,
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.categories).toHaveLength(7)
    expect(vm.series.circuits.some((n) => n > 0)).toBe(true)
    expect(vm.series.quickWorkout.some((n) => n > 0)).toBe(true)
    expect(vm.series.programme.some((n) => n > 0)).toBe(true)
    const stacked = vm.categories.reduce(
      (sum, _, i) =>
        sum +
        (vm.series.programme[i] ?? 0) +
        (vm.series.quickWorkout[i] ?? 0) +
        (vm.series.circuits[i] ?? 0),
      0,
    )
    expect(stacked).toBe(3)
  })

  it("caps 1y Mix at 13 month categories", () => {
    const vm = buildMixVm(
      snapshot([
        makeSession({
          id: "in-year",
          started_at: "2026-01-15T10:00:00.000Z",
          finished_at: "2026-01-15T11:00:00.000Z",
        }),
      ]),
      {
        kind: "365",
        from: "2025-08-22",
        to: "2026-08-21",
        timeZone: "UTC",
      },
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.categories.length).toBeLessThanOrEqual(13)
    expect(vm.categories.length).toBeGreaterThanOrEqual(12)
  })
})
