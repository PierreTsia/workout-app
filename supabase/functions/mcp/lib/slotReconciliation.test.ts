import { describe, expect, it } from "vitest"
import {
  detachedSoloExerciseIds,
  reconcileBlocks,
  reconcileSolos,
} from "./slotReconciliation"
import type { ParsedExercise } from "./createProgramValidation"

const ID_BENCH = "11111111-1111-4111-8111-111111111111"
const ID_PUSHUP = "22222222-2222-4222-8222-222222222222"
const ID_SQUAT = "33333333-3333-4333-8333-333333333333"
const ID_CINDY = "44444444-4444-4444-8444-444444444444"
const ID_MURPH = "55555555-5555-4555-8555-555555555555"

const benchObject: ParsedExercise = {
  kind: "object",
  exerciseId: ID_BENCH,
  sets: 4,
  reps: "8",
  weightKg: 60,
  restSeconds: 120,
  targetDurationSeconds: null,
}

const circuit = (benchmarkCircuitId: string | null): ParsedExercise => ({
  kind: "circuit",
  label: "Finisher",
  rounds: 3,
  restSeconds: 90,
  transitionSeconds: 0,
  exercises: [{ mode: "flat", exerciseId: ID_PUSHUP, amount: 10, weightKg: 0 }],
  benchmarkCircuitId,
})

describe("reconcileSolos", () => {
  it("matches an existing slot by exercise_id and preserves it, carrying the incoming index as sortOrder", () => {
    const existing = [{ id: "slot-1", exercise_id: ID_BENCH, sort_order: 0 }]

    const plan = reconcileSolos(existing, [benchObject])

    expect(plan.matched).toEqual([
      { existing: existing[0], incoming: benchObject, index: 0 },
    ])
    expect(plan.inserted).toEqual([])
    expect(plan.deleted).toEqual([])
  })

  it("inserts an incoming solo that matches no existing slot", () => {
    const plan = reconcileSolos([], [benchObject])

    expect(plan.matched).toEqual([])
    expect(plan.inserted).toEqual([{ incoming: benchObject, index: 0 }])
    expect(plan.deleted).toEqual([])
  })

  it("deletes a leftover existing slot absent from the incoming items", () => {
    const existing = [{ id: "slot-1", exercise_id: ID_PUSHUP, sort_order: 0 }]

    const plan = reconcileSolos(existing, [benchObject])

    expect(plan.matched).toEqual([])
    expect(plan.inserted).toEqual([{ incoming: benchObject, index: 0 }])
    expect(plan.deleted).toEqual([existing[0]])
  })

  it("matches duplicate exercise_ids greedily in order of appearance", () => {
    const existing = [
      { id: "slot-1", exercise_id: ID_BENCH, sort_order: 0 },
      { id: "slot-2", exercise_id: ID_BENCH, sort_order: 1 },
    ]

    const plan = reconcileSolos(existing, [benchObject])

    expect(plan.matched.map((m) => m.existing.id)).toEqual(["slot-1"])
    expect(plan.deleted.map((d) => d.id)).toEqual(["slot-2"])
  })

  it("ignores Circuit items but keeps the shared array index as sortOrder", () => {
    const existing = [{ id: "slot-1", exercise_id: ID_BENCH, sort_order: 0 }]

    const plan = reconcileSolos(existing, [circuit(null), benchObject])

    expect(plan.matched).toEqual([
      { existing: existing[0], incoming: benchObject, index: 1 },
    ])
  })
})

describe("reconcileBlocks", () => {
  it("matches by benchmark_circuit_id even when the order differs", () => {
    const existing = [
      { id: "block-generic", benchmark_circuit_id: null, sort_order: 0 },
      { id: "block-cindy", benchmark_circuit_id: ID_CINDY, sort_order: 1 },
    ]

    const plan = reconcileBlocks(existing, [circuit(ID_CINDY)])

    expect(plan.matched).toEqual([
      { existing: existing[1], incoming: expect.anything(), index: 0 },
    ])
    expect(plan.deleted).toEqual([existing[0]])
  })

  it("falls back to order for generic Circuits", () => {
    const existing = [
      { id: "block-1", benchmark_circuit_id: null, sort_order: 0 },
      { id: "block-2", benchmark_circuit_id: null, sort_order: 1 },
    ]

    const plan = reconcileBlocks(existing, [circuit(null), circuit(null)])

    expect(plan.matched.map((m) => m.existing.id)).toEqual(["block-1", "block-2"])
    expect(plan.inserted).toEqual([])
    expect(plan.deleted).toEqual([])
  })

  it("does not reuse a generic block for a named Circuit with no identity match (genuine swap mints a new block)", () => {
    const existing = [{ id: "block-1", benchmark_circuit_id: null, sort_order: 0 }]

    const plan = reconcileBlocks(existing, [circuit(ID_CINDY)])

    expect(plan.matched).toEqual([])
    expect(plan.inserted).toHaveLength(1)
    expect(plan.deleted).toEqual([existing[0]])
  })

  it("mints a new block when a named Circuit is swapped for another named Circuit", () => {
    const existing = [{ id: "block-cindy", benchmark_circuit_id: ID_CINDY, sort_order: 0 }]

    const plan = reconcileBlocks(existing, [circuit(ID_MURPH)])

    expect(plan.matched).toEqual([])
    expect(plan.inserted).toHaveLength(1)
    expect(plan.deleted).toEqual([existing[0]])
  })

  it("does not reuse a named block for a generic Circuit", () => {
    const existing = [{ id: "block-cindy", benchmark_circuit_id: ID_CINDY, sort_order: 0 }]

    const plan = reconcileBlocks(existing, [circuit(null)])

    expect(plan.matched).toEqual([])
    expect(plan.inserted).toHaveLength(1)
    expect(plan.deleted).toEqual([existing[0]])
  })

  it("pairs generic incoming with generic existing, leaving named blocks untouched", () => {
    const existing = [
      { id: "block-cindy", benchmark_circuit_id: ID_CINDY, sort_order: 0 },
      { id: "block-generic", benchmark_circuit_id: null, sort_order: 1 },
    ]

    const plan = reconcileBlocks(existing, [circuit(null)])

    expect(plan.matched.map((m) => m.existing.id)).toEqual(["block-generic"])
    expect(plan.inserted).toEqual([])
    expect(plan.deleted).toEqual([existing[0]])
  })

  it("inserts a Circuit when the day has no existing block", () => {
    const plan = reconcileBlocks([], [circuit(ID_CINDY)])

    expect(plan.matched).toEqual([])
    expect(plan.inserted).toHaveLength(1)
    expect(plan.deleted).toEqual([])
  })

  it("deletes a leftover block when the incoming day has no Circuit", () => {
    const existing = [{ id: "block-1", benchmark_circuit_id: null, sort_order: 0 }]

    const plan = reconcileBlocks(existing, [benchObject])

    expect(plan.matched).toEqual([])
    expect(plan.inserted).toEqual([])
    expect(plan.deleted).toEqual([existing[0]])
  })
})

describe("detachedSoloExerciseIds", () => {
  it("returns the exercise_ids of existing slots removed by the incoming items", () => {
    const detached = detachedSoloExerciseIds([ID_BENCH, ID_SQUAT], [benchObject])

    expect(detached).toEqual([ID_SQUAT])
  })

  it("returns nothing when every existing slot is still present", () => {
    expect(detachedSoloExerciseIds([ID_BENCH], [benchObject])).toEqual([])
  })
})
