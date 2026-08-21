import { describe, expect, it } from "vitest"
import {
  buildMixVm,
  buildMixVmFromRollups,
  MIX_SLICE_SQL,
  MIX_SLICE_VECTORS,
  mixSlice,
} from "./mixSlice"
import type { ProfileAllTimeRollups, ProfileSnapshot, SessionFact, YearRollup } from "./types"
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

function yearRollup(overrides: Partial<YearRollup> & Pick<YearRollup, "year">): YearRollup {
  return {
    mix: { programme: 0, quickWorkout: 0, circuits: 0 },
    tonnage_kg: 0,
    pr_pairs: 0,
    rir0_num: 0,
    rir0_den: 0,
    session_count: 1,
    duration_ms: 40 * 60_000,
    ...overrides,
  }
}

function rollups(years: YearRollup[]): ProfileAllTimeRollups {
  return {
    years,
    program_ids: [],
    regulars: [],
    pr_exercise_count: 0,
    last_pr_day: null,
  }
}

describe("buildMixVmFromRollups", () => {
  it("uses one Mix bar per year, not 52 weeks", () => {
    const vm = buildMixVmFromRollups(
      rollups([
        yearRollup({
          year: 2024,
          mix: { programme: 40, quickWorkout: 8, circuits: 2 },
          session_count: 50,
        }),
        yearRollup({
          year: 2025,
          mix: { programme: 0, quickWorkout: 0, circuits: 0 },
          session_count: 0,
        }),
        yearRollup({
          year: 2026,
          mix: { programme: 12, quickWorkout: 3, circuits: 1 },
          session_count: 16,
        }),
      ]),
    )

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.categories).toEqual(["2024", "2025", "2026"])
    expect(vm.categories).toHaveLength(3)
    expect(vm.series.programme).toEqual([40, 0, 12])
    expect(vm.series.quickWorkout).toEqual([8, 0, 3])
    expect(vm.series.circuits).toEqual([2, 0, 1])
  })

  it("marks Mix empty when the career has no sessions", () => {
    expect(buildMixVmFromRollups(rollups([]))).toEqual({ status: "empty" })
  })
})

describe("MIX_SLICE_SQL", () => {
  it("encodes the same Mix precedence as mixSlice on the shared vectors", () => {
    const whenOrder = [
      MIX_SLICE_SQL.indexOf("has_catalog_circuit"),
      MIX_SLICE_SQL.indexOf("'circuits'"),
      MIX_SLICE_SQL.indexOf("program_id IS NULL"),
      MIX_SLICE_SQL.indexOf("'quickWorkout'"),
      MIX_SLICE_SQL.indexOf("'programme'"),
    ]
    expect(whenOrder.every((index) => index >= 0)).toBe(true)
    expect(whenOrder).toEqual([...whenOrder].sort((a, b) => a - b))

    MIX_SLICE_VECTORS.forEach((vector) => {
      expect(mixSlice(vector)).toBe(vector.expected)
    })
  })
})
