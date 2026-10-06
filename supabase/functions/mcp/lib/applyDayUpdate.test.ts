import { describe, expect, it } from "vitest"
import { applyDayUpdate } from "./applyDayUpdate"
import type { CatalogExerciseForProgram } from "./programPersistence"
import type { ParsedExercise } from "./createProgramValidation"

const ID_BENCH = "11111111-1111-4111-8111-111111111111"
const ID_PUSHUP = "22222222-2222-4222-8222-222222222222"
const ID_OFF = "99999999-9999-4999-8999-999999999999"
const ID_CINDY = "44444444-4444-4444-8444-444444444444"
const DAY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const USER_ID = "uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu"

const BENCH: CatalogExerciseForProgram = {
  id: ID_BENCH,
  name: "Bench Press",
  muscle_group: "chest",
  emoji: null,
  equipment: "barbell",
  measurement_type: "reps",
  default_duration_seconds: null,
}

const PUSHUP: CatalogExerciseForProgram = {
  id: ID_PUSHUP,
  name: "Push-up",
  muscle_group: "chest",
  emoji: null,
  equipment: "bodyweight",
  measurement_type: "reps",
  default_duration_seconds: null,
}

const CATALOG = new Map([
  [ID_BENCH, BENCH],
  [ID_PUSHUP, PUSHUP],
])

interface Filter {
  type: "eq" | "in"
  col: string
  val: unknown
}

interface CallEntry {
  table: string
  op: "select" | "update" | "insert" | "delete"
  payload?: unknown
  filters: Filter[]
  returning?: string
  orderBy?: string
  terminal?: "single"
}

interface MockConfig {
  /** Rows returned by a SELECT on a table. */
  selectData?: Record<string, unknown[]>
  /** Indexed by call order; if present, that call returns this error. */
  errorAt?: Map<number, string>
}

function makeMockSupabase(config: MockConfig = {}) {
  const calls: CallEntry[] = []
  const errorAt = config.errorAt ?? new Map<number, string>()
  const selectData = config.selectData ?? {}
  let blockCounter = 0

  function maybeError() {
    return errorAt.get(calls.length - 1) ?? null
  }

  function execute(entry: CallEntry): { data: unknown; error: { message: string } | null } {
    calls.push(entry)
    const message = maybeError()
    if (message) return { data: null, error: { message } }

    if (entry.op === "select") {
      let rows = selectData[entry.table] ?? []
      if (entry.orderBy) {
        const col = entry.orderBy
        rows = rows
          .slice()
          .sort((a, b) => Number((a as Record<string, unknown>)[col]) - Number((b as Record<string, unknown>)[col]))
      }
      return { data: entry.terminal === "single" ? (rows[0] ?? null) : rows, error: null }
    }
    if (entry.op === "insert" && entry.table === "exercise_blocks" && entry.terminal === "single") {
      blockCounter += 1
      return { data: { id: `mock-block-${blockCounter}` }, error: null }
    }
    return { data: null, error: null }
  }

  return {
    calls,
    from(table: string) {
      const entry: CallEntry = { table, op: "select", filters: [] }
      const builder = {
        select(cols: string) {
          entry.returning = cols
          return builder
        },
        update(payload: unknown) {
          entry.op = "update"
          entry.payload = payload
          return builder
        },
        insert(payload: unknown) {
          entry.op = "insert"
          entry.payload = payload
          return builder
        },
        delete() {
          entry.op = "delete"
          return builder
        },
        eq(col: string, val: unknown) {
          entry.filters.push({ type: "eq", col, val })
          return builder
        },
        in(col: string, val: unknown[]) {
          entry.filters.push({ type: "in", col, val })
          return builder
        },
        order(col: string) {
          entry.orderBy = col
          return builder
        },
        single() {
          entry.terminal = "single"
          return Promise.resolve(execute(entry))
        },
        then(
          onFulfilled: (v: { data: unknown; error: unknown }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(execute(entry)).then(onFulfilled, onRejected)
        },
      }
      return builder
    },
  }
}

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

function opsOn(calls: CallEntry[], table: string, op: CallEntry["op"]) {
  return calls.filter((c) => c.table === table && c.op === op)
}

describe("applyDayUpdate — in-place reconciliation", () => {
  it("updates a matched solo in place, preserving its id, and never deletes it", async () => {
    const supabase = makeMockSupabase({
      selectData: {
        workout_exercises: [{ id: "slot-1", exercise_id: ID_BENCH, sort_order: 0 }],
        exercise_blocks: [],
      },
    })

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [benchObject],
      CATALOG,
      USER_ID,
    )

    expect(result).toEqual({ ok: true, inserted_count: 1 })
    expect(opsOn(supabase.calls, "workout_exercises", "delete")).toEqual([])
    expect(opsOn(supabase.calls, "workout_exercises", "insert")).toEqual([])
    const updates = opsOn(supabase.calls, "workout_exercises", "update")
    expect(updates).toHaveLength(1)
    expect(updates[0].filters).toEqual([{ type: "eq", col: "id", val: "slot-1" }])
    expect(updates[0].payload).toMatchObject({
      exercise_id: ID_BENCH,
      sets: 4,
      reps: "8",
      weight: "60",
      sort_order: 0,
    })
  })

  it("preserves Builder-set progression/config columns on a matched in-place UPDATE", async () => {
    const supabase = makeMockSupabase({
      selectData: {
        workout_exercises: [{ id: "slot-1", exercise_id: ID_BENCH, sort_order: 0 }],
        exercise_blocks: [],
      },
    })

    await applyDayUpdate(supabase as never, DAY_ID, [benchObject], CATALOG, USER_ID)

    const updates = opsOn(supabase.calls, "workout_exercises", "update")
    expect(updates).toHaveLength(1)
    const payload = updates[0].payload as Record<string, unknown>
    // The prescription and its snapshots are written…
    expect(payload).toMatchObject({
      sets: 4,
      reps: "8",
      weight: "60",
      rest_seconds: 120,
      target_duration_seconds: null,
      sort_order: 0,
      name_snapshot: "Bench Press",
      muscle_snapshot: "chest",
    })
    // …but the derived/config columns are left untouched (Builder owns them).
    for (const col of [
      "max_weight_reached",
      "rep_range_min",
      "rep_range_max",
      "set_range_min",
      "set_range_max",
      "duration_range_min_seconds",
      "duration_range_max_seconds",
      "duration_increment_seconds",
    ]) {
      expect(payload).not.toHaveProperty(col)
    }
  })

  it("inserts a solo that matches no existing slot", async () => {
    const supabase = makeMockSupabase({
      selectData: { workout_exercises: [], exercise_blocks: [] },
    })

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [benchObject],
      CATALOG,
      USER_ID,
    )

    expect(result).toEqual({ ok: true, inserted_count: 1 })
    const inserts = opsOn(supabase.calls, "workout_exercises", "insert")
    expect(inserts).toHaveLength(1)
    const rows = inserts[0].payload as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ workout_day_id: DAY_ID, exercise_id: ID_BENCH, sort_order: 0 })
  })

  it("deletes a leftover solo absent from the incoming items (swap mints a new slot)", async () => {
    const supabase = makeMockSupabase({
      selectData: {
        workout_exercises: [{ id: "slot-old", exercise_id: ID_PUSHUP, sort_order: 0 }],
        exercise_blocks: [],
      },
    })

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [benchObject],
      CATALOG,
      USER_ID,
    )

    expect(result).toEqual({ ok: true, inserted_count: 1 })
    const deletes = opsOn(supabase.calls, "workout_exercises", "delete")
    expect(deletes).toHaveLength(1)
    expect(deletes[0].filters).toEqual([{ type: "in", col: "id", val: ["slot-old"] }])
    expect(opsOn(supabase.calls, "workout_exercises", "insert")).toHaveLength(1)
  })

  it("preserves exercise_blocks.id when a Circuit matches by benchmark_circuit_id", async () => {
    const supabase = makeMockSupabase({
      selectData: {
        workout_exercises: [],
        exercise_blocks: [
          { id: "block-cindy", benchmark_circuit_id: ID_CINDY, sort_order: 0 },
        ],
        block_exercises: [{ id: "be-1", exercise_id: ID_PUSHUP, position: 0 }],
      },
    })

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [circuit(ID_CINDY)],
      CATALOG,
      USER_ID,
    )

    expect(result).toEqual({ ok: true, inserted_count: 1 })
    expect(opsOn(supabase.calls, "exercise_blocks", "delete")).toEqual([])
    expect(opsOn(supabase.calls, "exercise_blocks", "insert")).toEqual([])
    const updates = opsOn(supabase.calls, "exercise_blocks", "update")
    expect(updates).toHaveLength(1)
    expect(updates[0].filters).toEqual([{ type: "eq", col: "id", val: "block-cindy" }])
    // Nested cell reconciled in place too (set_logs.block_exercise_id preserved).
    expect(opsOn(supabase.calls, "block_exercises", "delete")).toEqual([])
    expect(opsOn(supabase.calls, "block_exercises", "insert")).toEqual([])
    const beUpdates = opsOn(supabase.calls, "block_exercises", "update")
    expect(beUpdates).toHaveLength(1)
    expect(beUpdates[0].filters).toEqual([{ type: "eq", col: "id", val: "be-1" }])
  })

  it("pairs duplicate-exercise block cells by position, preserving each cell's identity", async () => {
    const supabase = makeMockSupabase({
      selectData: {
        workout_exercises: [],
        exercise_blocks: [{ id: "block-1", benchmark_circuit_id: null, sort_order: 0 }],
        // Returned out of order on purpose: PostgreSQL gives no order without ORDER BY.
        block_exercises: [
          { id: "be-second", exercise_id: ID_PUSHUP, position: 1 },
          { id: "be-first", exercise_id: ID_PUSHUP, position: 0 },
        ],
      },
    })

    const duplicateCircuit: ParsedExercise = {
      kind: "circuit",
      label: "Finisher",
      rounds: 3,
      restSeconds: 90,
      transitionSeconds: 0,
      exercises: [
        { mode: "flat", exerciseId: ID_PUSHUP, amount: 10, weightKg: 0 },
        { mode: "flat", exerciseId: ID_PUSHUP, amount: 12, weightKg: 0 },
      ],
      benchmarkCircuitId: null,
    }

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [duplicateCircuit],
      CATALOG,
      USER_ID,
    )

    expect(result).toEqual({ ok: true, inserted_count: 1 })
    const beUpdates = opsOn(supabase.calls, "block_exercises", "update")
    expect(beUpdates).toHaveLength(2)
    // position 0 pairs with be-first, position 1 with be-second — not the raw fetch order.
    expect(beUpdates[0].filters).toEqual([{ type: "eq", col: "id", val: "be-first" }])
    expect(beUpdates[0].payload).toMatchObject({ position: 0 })
    expect(beUpdates[1].filters).toEqual([{ type: "eq", col: "id", val: "be-second" }])
    expect(beUpdates[1].payload).toMatchObject({ position: 1 })
    expect(opsOn(supabase.calls, "block_exercises", "delete")).toEqual([])
    expect(opsOn(supabase.calls, "block_exercises", "insert")).toEqual([])
  })

  it("inserts a new block and its cells when no existing block matches", async () => {
    const supabase = makeMockSupabase({
      selectData: { workout_exercises: [], exercise_blocks: [] },
    })

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [circuit(null)],
      CATALOG,
      USER_ID,
    )

    expect(result).toEqual({ ok: true, inserted_count: 1 })
    const blockInserts = opsOn(supabase.calls, "exercise_blocks", "insert")
    expect(blockInserts).toHaveLength(1)
    const beInserts = opsOn(supabase.calls, "block_exercises", "insert")
    expect(beInserts).toHaveLength(1)
    const rows = beInserts[0].payload as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ block_id: "mock-block-1", exercise_id: ID_PUSHUP })
  })

  it("deletes a leftover block when the incoming day has no Circuit", async () => {
    const supabase = makeMockSupabase({
      selectData: {
        workout_exercises: [],
        exercise_blocks: [{ id: "block-old", benchmark_circuit_id: null, sort_order: 0 }],
      },
    })

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [benchObject],
      CATALOG,
      USER_ID,
    )

    expect(result).toEqual({ ok: true, inserted_count: 1 })
    const deletes = opsOn(supabase.calls, "exercise_blocks", "delete")
    expect(deletes).toHaveLength(1)
    expect(deletes[0].filters).toEqual([{ type: "in", col: "id", val: ["block-old"] }])
  })

  it("returns a structured error and does NOT touch the database when an exerciseId is missing from the catalog", async () => {
    const supabase = makeMockSupabase()
    const orphanObject: ParsedExercise = { ...benchObject, exerciseId: ID_OFF }

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [orphanObject],
      CATALOG,
      USER_ID,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Catalog miss")
      expect(result.error).toContain(ID_OFF)
    }
    expect(supabase.calls).toEqual([])
  })

  it("propagates the supabase error message when the existing-slot fetch fails", async () => {
    const supabase = makeMockSupabase({ errorAt: new Map([[0, "SELECT blew up"]]) })

    const result = await applyDayUpdate(
      supabase as never,
      DAY_ID,
      [benchObject],
      CATALOG,
      USER_ID,
    )

    expect(result).toEqual({ ok: false, error: "SELECT blew up" })
    expect(supabase.calls).toHaveLength(1)
  })
})
