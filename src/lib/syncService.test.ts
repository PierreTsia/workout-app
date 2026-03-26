import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import {
  filterValidProgressionTargets,
  type ProgressionTarget,
} from "./syncService"

function makeTarget(overrides: Partial<ProgressionTarget> = {}): ProgressionTarget {
  return {
    workoutExerciseId: "we-1",
    reps: 10,
    weight: 80,
    sets: 3,
    ...overrides,
  }
}

describe("filterValidProgressionTargets", () => {
  it("returns empty array when targets is undefined", () => {
    expect(filterValidProgressionTargets(undefined)).toEqual([])
  })

  it("returns empty array when targets is empty", () => {
    expect(filterValidProgressionTargets([])).toEqual([])
  })

  it("keeps a fully valid target", () => {
    const targets = [makeTarget()]
    expect(filterValidProgressionTargets(targets)).toHaveLength(1)
  })

  it("drops target with NaN reps", () => {
    expect(filterValidProgressionTargets([makeTarget({ reps: NaN })])).toEqual([])
  })

  it("drops target with NaN weight", () => {
    expect(filterValidProgressionTargets([makeTarget({ weight: NaN })])).toEqual([])
  })

  it("drops target with NaN sets", () => {
    expect(filterValidProgressionTargets([makeTarget({ sets: NaN })])).toEqual([])
  })

  it("drops target with zero reps", () => {
    expect(filterValidProgressionTargets([makeTarget({ reps: 0 })])).toEqual([])
  })

  it("drops target with zero sets", () => {
    expect(filterValidProgressionTargets([makeTarget({ sets: 0 })])).toEqual([])
  })

  it("keeps target with zero weight (bodyweight exercise)", () => {
    const targets = [makeTarget({ weight: 0 })]
    expect(filterValidProgressionTargets(targets)).toHaveLength(1)
  })

  it("filters mixed valid and invalid targets", () => {
    const targets = [
      makeTarget({ reps: 10 }),
      makeTarget({ reps: NaN }),
      makeTarget({ sets: 0 }),
    ]
    const result = filterValidProgressionTargets(targets)
    expect(result).toHaveLength(1)
    expect(result[0].reps).toBe(10)
  })
})
