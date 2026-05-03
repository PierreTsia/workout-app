import { describe, expect, it } from "vitest"
import { applyProgramDiff } from "./updateProgramApply"
import type { CatalogExerciseForProgram } from "./programPersistence"
import type { ParsedExercise } from "./createProgramValidation"
import type {
  DiffDayDelete,
  DiffDayInsert,
  DiffDayUpdate,
  ProgramDiff,
} from "./updateProgramTypes"

// ---- Verbatim retry guidance string (acceptance criterion: must appear unchanged in
// every partial-failure message). Pulled into a constant so any drift fails the test.
const RETRY_GUIDANCE =
  "To retry, submit a new patch containing only the remaining_days (with their `id`s) plus any corrections; applied_days are already up to date and should be omitted from `days[]` (or included with their existing `id` to be left unchanged)."

// ---- Test fixtures ---------------------------------------------------------

const ID_PROGRAM = "pppppppp-pppp-4ppp-8ppp-pppppppppppp"
const ID_USER = "uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu"
const ID_BENCH = "11111111-1111-4111-8111-111111111111"
const ID_DAY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const ID_DAY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const ID_DAY_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const ID_DAY_D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

const BENCH: CatalogExerciseForProgram = {
  id: ID_BENCH,
  name: "Bench Press",
  muscle_group: "chest",
  emoji: null,
  equipment: "barbell",
  measurement_type: "reps",
  default_duration_seconds: null,
}

const catalog = new Map([[ID_BENCH, BENCH]])

const benchObject: ParsedExercise = {
  kind: "object",
  exerciseId: ID_BENCH,
  sets: 4,
  reps: "8",
  weightKg: 80,
  restSeconds: 120,
  targetDurationSeconds: null,
}

function emptyDiff(overrides: Partial<ProgramDiff> = {}): ProgramDiff {
  return {
    program_id: ID_PROGRAM,
    name_change: null,
    days_to_insert: [],
    days_to_update: [],
    days_to_delete: [],
    days_unchanged: [],
    apply_order: "default",
    ...overrides,
  }
}

function makeInsert(overrides: Partial<DiffDayInsert> = {}): DiffDayInsert {
  return {
    label: "New Day",
    emoji: "🏋️",
    sort_order: 0,
    parsed_exercises: [benchObject],
    ...overrides,
  }
}

function makeUpdate(overrides: Partial<DiffDayUpdate> = {}): DiffDayUpdate {
  return {
    id: ID_DAY_A,
    current: { label: "Old", emoji: "💪", sort_order: 0 },
    label: "New",
    emoji: "💪",
    sort_order: 0,
    parsed_exercises: [benchObject],
    ...overrides,
  }
}

function makeDelete(overrides: Partial<DiffDayDelete> = {}): DiffDayDelete {
  return {
    id: ID_DAY_A,
    label: "Going away",
    session_count: 0,
    blocking: false,
    ...overrides,
  }
}

// ---- MockSupabase ----------------------------------------------------------

interface CallEntry {
  table: string
  op: "update" | "delete" | "insert"
  payload?: unknown
  filter?: { col: string; val: unknown }[]
  returning?: string
}

class MockSupabase {
  callLog: CallEntry[] = []
  scripted = new Map<number, string>()
  private dayCounter = 0

  failAt(callIndex: number, message: string): this {
    this.scripted.set(callIndex, message)
    return this
  }

  /** First INSERT into workout_days returns "mock-day-new-1", then "-2", etc. */
  nextDayId(): string {
    this.dayCounter += 1
    return `mock-day-new-${this.dayCounter}`
  }

  from(table: string): MockBuilder {
    return new MockBuilder(this, table)
  }
}

class MockBuilder {
  constructor(
    private mock: MockSupabase,
    private table: string,
  ) {}

  update(payload: unknown) {
    this.mock.callLog.push({ table: this.table, op: "update", payload })
    return this
  }

  delete() {
    this.mock.callLog.push({ table: this.table, op: "delete" })
    return this
  }

  insert(payload: unknown) {
    this.mock.callLog.push({ table: this.table, op: "insert", payload })
    return this
  }

  eq(col: string, val: unknown) {
    const idx = this.mock.callLog.length - 1
    const last = this.mock.callLog[idx]
    last.filter = [...(last.filter ?? []), { col, val }]
    const message = this.mock.scripted.get(idx)
    return Promise.resolve(message ? { data: null, error: { message } } : { data: null, error: null })
  }

  select(cols: string) {
    const idx = this.mock.callLog.length - 1
    this.mock.callLog[idx].returning = cols
    return this
  }

  single() {
    const idx = this.mock.callLog.length - 1
    const last = this.mock.callLog[idx]
    const message = this.mock.scripted.get(idx)
    if (message) return Promise.resolve({ data: null, error: { message } })
    if (last.op === "insert" && last.table === "workout_days") {
      const id = this.mock.nextDayId()
      return Promise.resolve({ data: { id }, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }

  // Thenable: enables `await mockBuilder` after a bulk INSERT (no .select chain).
  then(resolve: (v: { data: null; error: null | { message: string } }) => void) {
    const idx = this.mock.callLog.length - 1
    const message = this.mock.scripted.get(idx)
    resolve({ data: null, error: message ? { message } : null })
  }
}

// ---- Tests -----------------------------------------------------------------

describe("applyProgramDiff", () => {
  it("renames the program and reports zero days touched when the diff carries only a name_change", async () => {
    const supabase = new MockSupabase()
    const diff = emptyDiff({ name_change: { from: "Old", to: "PPL v2" } })

    const result = await applyProgramDiff(supabase as never, diff, catalog, ID_USER)

    expect(result.failed_at).toBeNull()
    expect(result.applied_days).toEqual([])
    expect(result.remaining_days).toEqual([])
    expect(result.message).toBe("Updated 0 day(s).")
    expect(supabase.callLog).toHaveLength(1)
    expect(supabase.callLog[0]).toMatchObject({
      table: "programs",
      op: "update",
      payload: { name: "PPL v2" },
    })
    expect(supabase.callLog[0].filter).toEqual([{ col: "id", val: ID_PROGRAM }])
  })

  it("reports the rename failure with the synthetic '<program rename>' label and lists EVERY planned day in remaining_days, never touching workout_days/exercises", async () => {
    const supabase = new MockSupabase().failAt(0, "rename UPDATE blew up")
    const diff = emptyDiff({
      name_change: { from: "Old", to: "PPL v2" },
      days_to_delete: [makeDelete({ id: ID_DAY_A, label: "Drop me" })],
      days_to_update: [makeUpdate({ id: ID_DAY_B, label: "Edit me" })],
      days_to_insert: [makeInsert({ label: "Add me" })],
    })

    const result = await applyProgramDiff(supabase as never, diff, catalog, ID_USER)

    expect(result.applied_days).toEqual([])
    expect(result.failed_at).toEqual({
      day_label: "<program rename>",
      error: "rename UPDATE blew up",
    })
    expect(result.remaining_days).toEqual([
      { label: "Drop me", intent: "delete" },
      { label: "Edit me", intent: "update" },
      { label: "Add me", intent: "insert" },
    ])
    expect(result.message).toContain("rename UPDATE blew up")
    expect(result.message).toContain(RETRY_GUIDANCE)
    // Strict: only the rename UPDATE happened — no day ops.
    expect(supabase.callLog).toHaveLength(1)
    expect(supabase.callLog[0].table).toBe("programs")
  })

  it("inserts a new day, captures its returned id, and bulk-inserts its exercises", async () => {
    const supabase = new MockSupabase()
    const diff = emptyDiff({
      days_to_insert: [makeInsert({ label: "Cardio Light", emoji: "🏃", sort_order: 3 })],
    })

    const result = await applyProgramDiff(supabase as never, diff, catalog, ID_USER)

    expect(result.failed_at).toBeNull()
    expect(result.applied_days).toEqual([
      { id: "mock-day-new-1", label: "Cardio Light", ops: ["inserted"] },
    ])
    expect(result.message).toBe("Updated 1 day(s).")
    // Day INSERT precedes exercise INSERT.
    const dayIdx = supabase.callLog.findIndex(
      (c) => c.table === "workout_days" && c.op === "insert",
    )
    const exIdx = supabase.callLog.findIndex(
      (c) => c.table === "workout_exercises" && c.op === "insert",
    )
    expect(dayIdx).toBeGreaterThanOrEqual(0)
    expect(exIdx).toBeGreaterThan(dayIdx)
    expect(supabase.callLog[dayIdx].payload).toMatchObject({
      program_id: ID_PROGRAM,
      user_id: ID_USER,
      label: "Cardio Light",
      emoji: "🏃",
      sort_order: 3,
    })
  })

  it("updates day metadata and replaces its exercises, recording both ops when label changed", async () => {
    const supabase = new MockSupabase()
    const diff = emptyDiff({
      days_to_update: [
        makeUpdate({
          id: ID_DAY_A,
          current: { label: "Lundi", emoji: "💪", sort_order: 0 },
          label: "Push",
          emoji: "💪",
          sort_order: 0,
        }),
      ],
    })

    const result = await applyProgramDiff(supabase as never, diff, catalog, ID_USER)

    expect(result.failed_at).toBeNull()
    expect(result.applied_days).toEqual([
      { id: ID_DAY_A, label: "Push", ops: ["meta_changed", "exercises_replaced"] },
    ])
  })

  it("records ONLY 'exercises_replaced' when label/emoji/sort_order are unchanged (idempotent wipe-and-reinsert)", async () => {
    const supabase = new MockSupabase()
    const diff = emptyDiff({
      days_to_update: [
        makeUpdate({
          id: ID_DAY_A,
          current: { label: "Push", emoji: "💪", sort_order: 0 },
          label: "Push",
          emoji: "💪",
          sort_order: 0,
        }),
      ],
    })

    const result = await applyProgramDiff(supabase as never, diff, catalog, ID_USER)

    expect(result.applied_days).toEqual([
      { id: ID_DAY_A, label: "Push", ops: ["exercises_replaced"] },
    ])
    // No UPDATE on workout_days when meta is unchanged.
    expect(supabase.callLog.some((c) => c.table === "workout_days" && c.op === "update")).toBe(false)
  })

  it("deletes a day by clearing workout_exercises then workout_days and tagging the entry as 'deleted'", async () => {
    const supabase = new MockSupabase()
    const diff = emptyDiff({
      days_to_delete: [makeDelete({ id: ID_DAY_A, label: "Saturday Cardio" })],
    })

    const result = await applyProgramDiff(supabase as never, diff, catalog, ID_USER)

    expect(result.failed_at).toBeNull()
    expect(result.applied_days).toEqual([
      { id: ID_DAY_A, label: "Saturday Cardio", ops: ["deleted"] },
    ])
    // Order: delete workout_exercises (defensive), then delete workout_days.
    const exIdx = supabase.callLog.findIndex(
      (c) => c.table === "workout_exercises" && c.op === "delete",
    )
    const dayIdx = supabase.callLog.findIndex(
      (c) => c.table === "workout_days" && c.op === "delete",
    )
    expect(exIdx).toBeGreaterThanOrEqual(0)
    expect(dayIdx).toBeGreaterThan(exIdx)
  })

  it("returns a partial-success report with the verbatim retry guidance string when a day fails mid-flight", async () => {
    // Plan = 4 deletes (default order). Each delete = 2 calls (workout_exercises + workout_days).
    // Fail call index 2 → second delete fails on its workout_exercises step.
    const supabase = new MockSupabase().failAt(2, "transient connection blip")
    const diff = emptyDiff({
      days_to_delete: [
        makeDelete({ id: ID_DAY_A, label: "Day A" }),
        makeDelete({ id: ID_DAY_B, label: "Day B" }),
        makeDelete({ id: ID_DAY_C, label: "Day C" }),
        makeDelete({ id: ID_DAY_D, label: "Day D" }),
      ],
    })

    const result = await applyProgramDiff(supabase as never, diff, catalog, ID_USER)

    expect(result.applied_days).toEqual([
      { id: ID_DAY_A, label: "Day A", ops: ["deleted"] },
    ])
    expect(result.failed_at).toEqual({
      day_label: "Day B",
      error: "transient connection blip",
    })
    expect(result.remaining_days).toEqual([
      { label: "Day C", intent: "delete" },
      { label: "Day D", intent: "delete" },
    ])
    expect(result.message).toContain("Updated 1 day(s)")
    expect(result.message).toContain("Failed at day 'Day B'")
    expect(result.message).toContain("transient connection blip")
    expect(result.message).toContain("2 day(s) remaining")
    expect(result.message).toContain(RETRY_GUIDANCE)
    // No further DB ops after the failure.
    expect(supabase.callLog.length).toBe(3) // op0 (2 calls) + op1 (1 call that failed)
  })

  it("smart re-order: applies INSERTs BEFORE DELETEs when the diff carries apply_order='insert_first' (drain-to-0 + refill scenario)", async () => {
    const supabase = new MockSupabase()
    const diff = emptyDiff({
      apply_order: "insert_first",
      days_to_delete: [makeDelete({ id: ID_DAY_A, label: "Old A" })],
      days_to_insert: [makeInsert({ label: "Brand new", sort_order: 0 })],
    })

    const result = await applyProgramDiff(supabase as never, diff, catalog, ID_USER)

    expect(result.failed_at).toBeNull()
    expect(result.applied_days).toHaveLength(2)
    expect(result.applied_days[0].ops).toEqual(["inserted"])
    expect(result.applied_days[1].ops).toEqual(["deleted"])

    // Strict: every workout_days INSERT precedes any workout_days DELETE.
    const firstInsertIdx = supabase.callLog.findIndex(
      (c) => c.table === "workout_days" && c.op === "insert",
    )
    const firstDeleteIdx = supabase.callLog.findIndex(
      (c) => c.table === "workout_days" && c.op === "delete",
    )
    expect(firstInsertIdx).toBeGreaterThanOrEqual(0)
    expect(firstDeleteIdx).toBeGreaterThan(firstInsertIdx)
  })

  it("default order: applies DELETEs BEFORE INSERTs when apply_order='default' (partial drain, no risk of empty intermediate state)", async () => {
    const supabase = new MockSupabase()
    const diff = emptyDiff({
      apply_order: "default",
      days_to_delete: [makeDelete({ id: ID_DAY_A, label: "Old A" })],
      days_to_insert: [makeInsert({ label: "Brand new", sort_order: 0 })],
    })

    const result = await applyProgramDiff(supabase as never, diff, catalog, ID_USER)

    expect(result.failed_at).toBeNull()
    expect(result.applied_days).toHaveLength(2)
    expect(result.applied_days[0].ops).toEqual(["deleted"])
    expect(result.applied_days[1].ops).toEqual(["inserted"])

    const firstDeleteIdx = supabase.callLog.findIndex(
      (c) => c.table === "workout_days" && c.op === "delete",
    )
    const firstInsertIdx = supabase.callLog.findIndex(
      (c) => c.table === "workout_days" && c.op === "insert",
    )
    expect(firstDeleteIdx).toBeGreaterThanOrEqual(0)
    expect(firstInsertIdx).toBeGreaterThan(firstDeleteIdx)
  })
})
