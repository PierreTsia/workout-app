/**
 * Integration tests for the `update_program` MCP tool handler (T81, Epic C #280).
 *
 * Black-box: drives the registered handler with an in-memory mock supabase that
 * - simulates RLS by filtering programs by user_id on SELECT,
 * - records every write op (op + table + payload + filters) in a callLog so
 *   the dry_run-zero-writes test can assert on it,
 * - supports scripted error injection at a specific table/op pair to drive
 *   the partial-success scenario.
 *
 * The mock is intentionally minimal — only the chains the handler actually
 * builds are implemented. Unsupported chains throw loudly.
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
  assertNotMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import { updateProgram } from "./updateProgram.ts"

// ---------------------------------------------------------------------------
// Verbatim retry guidance — must round-trip unchanged from T80 through T81.
// ---------------------------------------------------------------------------

const RETRY_GUIDANCE =
  "To retry, submit a new patch containing only the remaining_days (with their `id`s) plus any corrections; applied_days are already up to date and should be omitted from `days[]` (or included with their existing `id` to be left unchanged)."

// ---------------------------------------------------------------------------
// Fixture ids (deterministic UUIDs)
// ---------------------------------------------------------------------------

const ID_USER = "11111111-1111-4111-8111-111111111111"
const ID_OTHER_USER = "22222222-2222-4222-8222-222222222222"
const ID_PROGRAM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const ID_OTHER_PROGRAM = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const ID_DAY_PUSH = "cccccccc-1111-4111-8111-cccccccccccc"
const ID_DAY_PULL = "cccccccc-2222-4222-8222-cccccccccccc"
const ID_BENCH = "dddddddd-1111-4111-8111-dddddddddddd"
const ID_PUSHUP = "dddddddd-2222-4222-8222-dddddddddddd"

const BENCH = {
  id: ID_BENCH,
  name: "Bench Press",
  muscle_group: "chest",
  emoji: null,
  equipment: "barbell",
  measurement_type: "reps",
  default_duration_seconds: null,
}

const PUSHUP = {
  id: ID_PUSHUP,
  name: "Push-up",
  muscle_group: "chest",
  emoji: null,
  equipment: "bodyweight",
  measurement_type: "reps",
  default_duration_seconds: null,
}

// ---------------------------------------------------------------------------
// Mock state shapes
// ---------------------------------------------------------------------------

interface ProgramRow {
  id: string
  user_id: string
  name: string
}

interface DayRow {
  id: string
  program_id: string
  user_id: string
  label: string
  emoji: string
  sort_order: number
}

interface ExerciseRow {
  id: string
  workout_day_id: string
  exercise_id: string
  name_snapshot: string
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  target_duration_seconds: number | null
  sort_order: number
  // extra columns persisted by buildWorkoutExerciseInsertRowsForDay; ignored by tests
  [extra: string]: unknown
}

interface SessionRow {
  id: string
  workout_day_id: string
  user_id: string
}

interface CycleRow {
  id: string
  program_id: string
  started_at: string
  finished_at: string | null
}

interface MockState {
  programs: ProgramRow[]
  days: DayRow[]
  exercises: ExerciseRow[]
  /** T164 — Circuit wipe/insert surface for daySequence. */
  blocks: Record<string, unknown>[]
  blockExercises: Record<string, unknown>[]
  sessions: SessionRow[]
  cycles: CycleRow[]
  catalog: typeof BENCH[]
}

interface CallEntry {
  op: "select" | "update" | "delete" | "insert"
  table: string
  payload?: unknown
  filters?: Filter[]
  returning?: string
  terminal?: "single" | "maybeSingle"
}

interface Filter {
  type: "eq" | "in" | "is"
  col: string
  val: unknown
}

interface FaultRule {
  table: string
  op: "select" | "update" | "delete" | "insert"
  /** 0-indexed nth occurrence of (table, op) at which to inject the fault. */
  occurrence: number
  message: string
}

// ---------------------------------------------------------------------------
// MockSupabase
// ---------------------------------------------------------------------------

class MockSupabase {
  callLog: CallEntry[] = []
  faults: FaultRule[] = []
  occurrenceCount = new Map<string, number>()
  dayIdCounter = 0

  constructor(
    public state: MockState,
    public currentUserId: string = ID_USER,
  ) {}

  failOn(rule: FaultRule): this {
    this.faults.push(rule)
    return this
  }

  consumeFault(table: string, op: CallEntry["op"]): string | null {
    const key = `${table}:${op}`
    const idx = this.occurrenceCount.get(key) ?? 0
    this.occurrenceCount.set(key, idx + 1)
    const match = this.faults.find(
      (f) => f.table === table && f.op === op && f.occurrence === idx,
    )
    return match ? match.message : null
  }

  nextDayId(): string {
    this.dayIdCounter += 1
    return `mock-day-new-${this.dayIdCounter}`
  }

  auth = {
    getUser: () =>
      Promise.resolve({
        data: { user: { id: this.currentUserId } },
        error: null,
      }),
  }

  from(table: string): MockBuilder {
    return new MockBuilder(this, table)
  }
}

class MockBuilder {
  private entry: CallEntry
  private filters: Filter[] = []

  constructor(
    private mock: MockSupabase,
    private table: string,
  ) {
    this.entry = { op: "select", table }
  }

  // --- starters ---

  select(cols: string): this {
    this.entry.op = this.entry.op === "select" ? "select" : this.entry.op
    this.entry.returning = cols
    return this
  }

  update(payload: unknown): this {
    this.entry.op = "update"
    this.entry.payload = payload
    return this
  }

  delete(): this {
    this.entry.op = "delete"
    return this
  }

  insert(payload: unknown): this {
    this.entry.op = "insert"
    this.entry.payload = payload
    return this
  }

  // --- filters ---

  eq(col: string, val: unknown): this {
    this.filters.push({ type: "eq", col, val })
    return this
  }

  in(col: string, val: unknown[]): this {
    this.filters.push({ type: "in", col, val })
    return this
  }

  is(col: string, val: unknown): this {
    this.filters.push({ type: "is", col, val })
    return this
  }

  // --- terminals ---

  single(): Promise<{ data: unknown; error: { message: string } | null }> {
    this.entry.terminal = "single"
    return this.execute()
  }

  maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }> {
    this.entry.terminal = "maybeSingle"
    return this.execute()
  }

  // Thenable: enables `await builder` for chains without single/maybeSingle
  // (e.g. bulk INSERT, UPDATE/DELETE filtered by .eq, SELECT lists).
  then<T1, T2>(
    onFulfilled: (v: { data: unknown; error: { message: string } | null }) => T1 | PromiseLike<T1>,
    onRejected?: (reason: unknown) => T2 | PromiseLike<T2>,
  ): Promise<T1 | T2> {
    return this.execute().then(onFulfilled, onRejected)
  }

  private async execute(): Promise<{ data: unknown; error: { message: string } | null }> {
    this.entry.filters = this.filters
    this.mock.callLog.push(this.entry)

    const fault = this.mock.consumeFault(this.table, this.entry.op)
    if (fault) {
      return { data: null, error: { message: fault } }
    }

    if (this.entry.op === "select") return this.executeSelect()
    if (this.entry.op === "update") return this.executeUpdate()
    if (this.entry.op === "delete") return this.executeDelete()
    return this.executeInsert()
  }

  private executeSelect(): { data: unknown; error: null } {
    const t = this.table
    const f = this.filters

    if (t === "programs") {
      const candidates = this.mock.state.programs
        .filter((p) => p.user_id === this.mock.currentUserId)
        .filter((p) => matchAll(p, f))
      const result = candidates.map((p) => embedProgram(p, this.mock.state))
      return finalizeSelect(result, this.entry.terminal)
    }

    if (t === "exercises") {
      const rows = this.mock.state.catalog.filter((e) => matchAll(e, f))
      return finalizeSelect(rows, this.entry.terminal)
    }

    if (t === "benchmark_circuits") {
      return finalizeSelect([], this.entry.terminal)
    }

    if (t === "sessions") {
      const rows = this.mock.state.sessions.filter((s) => matchAll(s, f))
      return finalizeSelect(
        rows.map((r) => ({ workout_day_id: r.workout_day_id })),
        this.entry.terminal,
      )
    }

    if (t === "cycles") {
      const rows = this.mock.state.cycles.filter((c) => matchAll(c, f))
      return finalizeSelect(
        rows.map((r) => ({ started_at: r.started_at })),
        this.entry.terminal,
      )
    }

    throw new Error(`MockSupabase.select: unsupported table "${t}"`)
  }

  private executeUpdate(): { data: null; error: null } {
    const t = this.table
    const f = this.filters
    const payload = this.entry.payload as Record<string, unknown>
    const targets = (this.mock.state[stateKeyForTable(t)] as Record<string, unknown>[]).filter(
      (r) => matchAll(r, f),
    )
    targets.forEach((r) => Object.assign(r, payload))
    return { data: null, error: null }
  }

  private executeDelete(): { data: null; error: null } {
    const t = this.table
    const f = this.filters
    const key = stateKeyForTable(t)
    const arr = this.mock.state[key] as Record<string, unknown>[]
    const remaining = arr.filter((r) => !matchAll(r, f))
    ;(this.mock.state[key] as Record<string, unknown>[]).length = 0
    ;(this.mock.state[key] as Record<string, unknown>[]).push(...remaining)
    return { data: null, error: null }
  }

  private executeInsert(): { data: unknown; error: null } {
    const t = this.table
    const payload = this.entry.payload

    if (t === "workout_days") {
      const row = payload as Omit<DayRow, "id">
      const id = this.mock.nextDayId()
      const full: DayRow = { id, ...row }
      this.mock.state.days.push(full)
      if (this.entry.terminal === "single") {
        return { data: { id }, error: null }
      }
      return { data: null, error: null }
    }

    if (t === "workout_exercises") {
      const rows = (payload as Record<string, unknown>[]).map((r, i) => ({
        ...r,
        id: `mock-ex-${this.mock.state.exercises.length + i + 1}`,
      })) as ExerciseRow[]
      this.mock.state.exercises.push(...rows)
      return { data: null, error: null }
    }

    if (t === "exercise_blocks") {
      const id = `mock-block-${this.mock.state.blocks.length + 1}`
      const row = { ...(payload as Record<string, unknown>), id }
      this.mock.state.blocks.push(row)
      if (this.entry.terminal === "single") {
        return { data: { id }, error: null }
      }
      return { data: null, error: null }
    }

    if (t === "block_exercises") {
      const rows = Array.isArray(payload) ? payload : [payload]
      this.mock.state.blockExercises.push(...(rows as Record<string, unknown>[]))
      return { data: null, error: null }
    }

    throw new Error(`MockSupabase.insert: unsupported table "${t}"`)
  }
}

function matchAll<T>(row: T, filters: Filter[]): boolean {
  const cells = row as Record<string, unknown>
  return filters.every((f) => {
    if (f.type === "eq") return cells[f.col] === f.val
    if (f.type === "in") {
      const list = f.val as unknown[]
      return list.includes(cells[f.col])
    }
    if (f.type === "is") return cells[f.col] === f.val
    return true
  })
}

function stateKeyForTable(table: string): keyof MockState {
  switch (table) {
    case "programs":
      return "programs"
    case "workout_days":
      return "days"
    case "workout_exercises":
      return "exercises"
    case "exercise_blocks":
      return "blocks"
    case "block_exercises":
      return "blockExercises"
    case "sessions":
      return "sessions"
    case "cycles":
      return "cycles"
    case "exercises":
      return "catalog"
  }
  throw new Error(`Unknown table: ${table}`)
}

function embedProgram(p: ProgramRow, state: MockState): unknown {
  const days = state.days
    .filter((d) => d.program_id === p.id)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => ({
      id: d.id,
      label: d.label,
      emoji: d.emoji,
      sort_order: d.sort_order,
      workout_exercises: state.exercises
        .filter((ex) => ex.workout_day_id === d.id)
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((ex) => ({
          exercise_id: ex.exercise_id,
          name_snapshot: ex.name_snapshot,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          rest_seconds: ex.rest_seconds,
          target_duration_seconds: ex.target_duration_seconds,
          sort_order: ex.sort_order,
        })),
    }))
  return { id: p.id, name: p.name, workout_days: days }
}

function finalizeSelect(
  rows: unknown[],
  terminal?: "single" | "maybeSingle",
): { data: unknown; error: null } {
  if (terminal === "maybeSingle") {
    return { data: rows.length > 0 ? rows[0] : null, error: null }
  }
  if (terminal === "single") {
    return { data: rows[0] ?? null, error: null }
  }
  return { data: rows, error: null }
}

// ---------------------------------------------------------------------------
// State factories
// ---------------------------------------------------------------------------

function makeBaseState(): MockState {
  return {
    programs: [
      { id: ID_PROGRAM, user_id: ID_USER, name: "PPL" },
      { id: ID_OTHER_PROGRAM, user_id: ID_OTHER_USER, name: "Other Routine" },
    ],
    days: [
      {
        id: ID_DAY_PUSH,
        program_id: ID_PROGRAM,
        user_id: ID_USER,
        label: "Push",
        emoji: "💪",
        sort_order: 0,
      },
      {
        id: ID_DAY_PULL,
        program_id: ID_PROGRAM,
        user_id: ID_USER,
        label: "Pull",
        emoji: "🪝",
        sort_order: 1,
      },
    ],
    blocks: [],
    blockExercises: [],
    exercises: [
      {
        id: "seed-ex-1",
        workout_day_id: ID_DAY_PUSH,
        exercise_id: ID_BENCH,
        name_snapshot: "Bench Press",
        sets: 4,
        reps: "8",
        weight: "80",
        rest_seconds: 120,
        target_duration_seconds: null,
        sort_order: 0,
      },
      {
        id: "seed-ex-2",
        workout_day_id: ID_DAY_PULL,
        exercise_id: ID_PUSHUP,
        name_snapshot: "Push-up",
        sets: 3,
        reps: "10",
        weight: "0",
        rest_seconds: 90,
        target_duration_seconds: null,
        sort_order: 0,
      },
    ],
    sessions: [],
    cycles: [],
    catalog: [BENCH, PUSHUP],
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseReply(reply: { content: Array<{ text: string }> }): Record<string, unknown> {
  return JSON.parse(reply.content[0].text) as Record<string, unknown>
}

function writeOps(callLog: CallEntry[]): CallEntry[] {
  return callLog.filter(
    (c) =>
      (c.op === "insert" || c.op === "update" || c.op === "delete") &&
      (c.table === "programs" ||
        c.table === "workout_days" ||
        c.table === "workout_exercises"),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("update_program renames the program (apply success, no day touched)", async () => {
  const mock = new MockSupabase(makeBaseState())

  const reply = await updateProgram.handler(
    { program_id: ID_PROGRAM, name: "PPL v2", dry_run: false },
    mock as never,
  )

  assertEquals(reply.isError ?? false, false)
  const body = parseReply(reply)
  assertEquals(body.dry_run, false)
  assertEquals(body.applied_days, [])
  assertEquals(body.failed_at, null)
  assertEquals(body.remaining_days, [])
  // State updated.
  assertEquals(
    mock.state.programs.find((p) => p.id === ID_PROGRAM)?.name,
    "PPL v2",
  )
  // Single program UPDATE — no day or exercise writes.
  const writes = writeOps(mock.callLog)
  assertEquals(writes.length, 1)
  assertEquals(writes[0].table, "programs")
  assertEquals(writes[0].op, "update")
})

Deno.test("update_program adds a new day, captures its id, and reports it in applied_days", async () => {
  const mock = new MockSupabase(makeBaseState())

  const reply = await updateProgram.handler(
    {
      program_id: ID_PROGRAM,
      days: [
        // Keep current days unchanged (carry their ids + same exercises shape).
        {
          id: ID_DAY_PUSH,
          label: "Push",
          emoji: "💪",
          exercises: [ID_BENCH],
        },
        {
          id: ID_DAY_PULL,
          label: "Pull",
          emoji: "🪝",
          exercises: [ID_PUSHUP],
        },
        // New day — no `id`.
        {
          label: "Legs",
          emoji: "🦵",
          exercises: [ID_BENCH],
        },
      ],
      dry_run: false,
    },
    mock as never,
  )

  assertEquals(reply.isError ?? false, false)
  const body = parseReply(reply)
  const applied = body.applied_days as Array<{ label: string; ops: string[]; id: string }>
  const inserted = applied.find((a) => a.label === "Legs")
  assertExists(inserted)
  assertEquals(inserted!.ops, ["inserted"])
  assertEquals(inserted!.id, "mock-day-new-1")
  // 3 days persist.
  const newDays = mock.state.days.filter((d) => d.program_id === ID_PROGRAM)
  assertEquals(newDays.length, 3)
})

Deno.test("update_program blocks deletion of a day with logged sessions (FK pre-check) and writes nothing", async () => {
  const state = makeBaseState()
  // Pull day has 2 logged sessions → FK pre-check should block deletion.
  state.sessions.push(
    { id: "s1", workout_day_id: ID_DAY_PULL, user_id: ID_USER },
    { id: "s2", workout_day_id: ID_DAY_PULL, user_id: ID_USER },
  )
  const mock = new MockSupabase(state)

  const reply = await updateProgram.handler(
    {
      program_id: ID_PROGRAM,
      // Omit Pull → DELETE intended. Pass confirm so we reach the FK check.
      days: [
        {
          id: ID_DAY_PUSH,
          label: "Push",
          emoji: "💪",
          exercises: [ID_BENCH],
        },
      ],
      dry_run: false,
      confirm: true,
    },
    mock as never,
  )

  assertEquals(reply.isError, true)
  const text = reply.content[0].text
  assertStringIncludes(text, "Pull")
  assertStringIncludes(text, "2 logged sessions")
  // No mutating writes happened on programs/workout_days/workout_exercises.
  assertEquals(writeOps(mock.callLog).length, 0)
})

Deno.test("update_program rejects destructive apply without confirm and writes nothing", async () => {
  const mock = new MockSupabase(makeBaseState())

  const reply = await updateProgram.handler(
    {
      program_id: ID_PROGRAM,
      // Omit Pull → DELETE intended, but no confirm.
      days: [
        {
          id: ID_DAY_PUSH,
          label: "Push",
          emoji: "💪",
          exercises: [ID_BENCH],
        },
      ],
      dry_run: false,
    },
    mock as never,
  )

  assertEquals(reply.isError, true)
  const text = reply.content[0].text
  assertStringIncludes(text, "confirm: true")
  assertEquals(writeOps(mock.callLog).length, 0)
})

Deno.test("update_program defaults to dry_run when the flag is omitted — no writes, full preview returned", async () => {
  const mock = new MockSupabase(makeBaseState())

  const reply = await updateProgram.handler(
    {
      program_id: ID_PROGRAM,
      name: "PPL v2",
      days: [
        {
          id: ID_DAY_PUSH,
          label: "Push v2",
          emoji: "💪",
          exercises: [
            {
              exercise_id: ID_BENCH,
              sets: 5,
              reps: "5",
              weight_kg: 100,
              rest_seconds: 180,
            },
          ],
        },
        // Implicit DELETE of Pull (omitted) — surfaces in removed_days.
        // Implicit INSERT of Legs.
        {
          label: "Legs",
          emoji: "🦵",
          exercises: [ID_BENCH],
        },
      ],
      // dry_run intentionally omitted → defaults to true.
    },
    mock as never,
  )

  assertEquals(reply.isError ?? false, false)
  const body = parseReply(reply)
  assertEquals(body.dry_run, true)
  // Preview includes the renamed program + new day prescription.
  assertStringIncludes(body.rendered as string, "PPL v2")
  assertStringIncludes(body.rendered as string, "Push v2")
  assertStringIncludes(body.rendered as string, "Bench Press — 5 × 5 × 100 kg total — 180s rest")
  // Removed/added bookkeeping.
  const removed = body.removed_days as Array<{ id: string; label: string }>
  assertEquals(removed.length, 1)
  assertEquals(removed[0].label, "Pull")
  const added = body.added_days as Array<{ label: string }>
  assertEquals(added, [{ label: "Legs" }])
  // Zero writes recorded.
  assertEquals(writeOps(mock.callLog).length, 0)
})

Deno.test("update_program surfaces the active-cycle warning in BOTH dry_run and apply responses", async () => {
  const stateApply = makeBaseState()
  stateApply.cycles.push({
    id: "cyc-1",
    program_id: ID_PROGRAM,
    started_at: "2026-04-15T10:00:00.000Z",
    finished_at: null,
  })
  const mockApply = new MockSupabase(stateApply)

  const applyReply = await updateProgram.handler(
    { program_id: ID_PROGRAM, name: "PPL v2", dry_run: false },
    mockApply as never,
  )
  const applyBody = parseReply(applyReply)
  const applyWarnings = applyBody.warnings as string[]
  assertEquals(applyWarnings.length, 1)
  assertStringIncludes(applyWarnings[0], "Cycle actif depuis 2026-04-15")

  // Re-run as dry_run — same cycle state, same warning expected.
  const stateDry = makeBaseState()
  stateDry.cycles.push({
    id: "cyc-1",
    program_id: ID_PROGRAM,
    started_at: "2026-04-15T10:00:00.000Z",
    finished_at: null,
  })
  const mockDry = new MockSupabase(stateDry)

  const dryReply = await updateProgram.handler(
    { program_id: ID_PROGRAM, name: "PPL v2" },
    mockDry as never,
  )
  const dryBody = parseReply(dryReply)
  const dryWarnings = dryBody.warnings as string[]
  assertEquals(dryWarnings.length, 1)
  assertStringIncludes(dryWarnings[0], "Cycle actif depuis 2026-04-15")
})

Deno.test("update_program returns a partial-success report when a mid-flight day INSERT fails", async () => {
  const mock = new MockSupabase(makeBaseState())
  // Two new days planned. Fail the SECOND `workout_days.insert` call.
  // The plan order is: [...deletes, ...updates, ...inserts]. Our patch keeps both
  // current days as updates (so 2 update flows fire first), then attempts 2 inserts.
  // The 0th workout_days.insert is the first new day; the 1st is the second.
  mock.failOn({
    table: "workout_days",
    op: "insert",
    occurrence: 1,
    message: "boom on second insert",
  })

  const reply = await updateProgram.handler(
    {
      program_id: ID_PROGRAM,
      days: [
        // Keep both current days as updates so the apply plan reaches the inserts.
        {
          id: ID_DAY_PUSH,
          label: "Push",
          emoji: "💪",
          exercises: [ID_BENCH],
        },
        {
          id: ID_DAY_PULL,
          label: "Pull",
          emoji: "🪝",
          exercises: [ID_PUSHUP],
        },
        // New: day "Legs" inserts cleanly.
        { label: "Legs", emoji: "🦵", exercises: [ID_BENCH] },
        // New: day "Mobility" — second insert, scripted to fail.
        { label: "Mobility", emoji: "🧘", exercises: [ID_BENCH] },
      ],
      dry_run: false,
    },
    mock as never,
  )

  assertEquals(reply.isError, true)
  const body = parseReply(reply)
  const applied = body.applied_days as Array<{ label: string }>
  // The two updates AND the first insert succeed → 3 applied.
  assertEquals(applied.length, 3)
  const labelsApplied = applied.map((a) => a.label)
  assertEquals(labelsApplied.includes("Legs"), true)
  const failedAt = body.failed_at as { day_label: string; error: string } | null
  assertExists(failedAt)
  assertEquals(failedAt!.day_label, "Mobility")
  assertStringIncludes(failedAt!.error, "boom on second insert")
  const remaining = body.remaining_days as Array<{ label: string; intent: string }>
  // After the failure on Mobility, nothing remains.
  assertEquals(remaining, [])
  // Verbatim retry guidance round-trips through.
  assertStringIncludes(body.message as string, RETRY_GUIDANCE)
})

Deno.test("update_program rejects access to another user's program with the RLS-style 'not found' message and writes nothing", async () => {
  const mock = new MockSupabase(makeBaseState(), ID_USER)

  const reply = await updateProgram.handler(
    { program_id: ID_OTHER_PROGRAM, name: "hijack attempt", dry_run: false },
    mock as never,
  )

  assertEquals(reply.isError, true)
  assertEquals(
    reply.content[0].text,
    "Program not found or you don't have access.",
  )
  assertEquals(writeOps(mock.callLog).length, 0)
  // Other user's program name unchanged.
  assertEquals(
    mock.state.programs.find((p) => p.id === ID_OTHER_PROGRAM)?.name,
    "Other Routine",
  )
})

Deno.test("update_program rejects is_active in the patch with a pointer to set_active_program", async () => {
  const mock = new MockSupabase(makeBaseState())

  const reply = await updateProgram.handler(
    { program_id: ID_PROGRAM, is_active: true },
    mock as never,
  )

  assertEquals(reply.isError, true)
  assertStringIncludes(reply.content[0].text, "set_active_program")
  assertNotMatch(reply.content[0].text, /unknown field/i)
})

// ---------------------------------------------------------------------------
// Issue #320 regression — bodyweight + weight_kg > 0 on declarative echo.
//
// The bug: a program contains a bodyweight exercise whose stored weight is > 0
// (legacy data, either from pre-T74 lax validation or catalog drift). The agent
// reads the program, echoes the day verbatim inside `update_program`, and the
// R1 cross-field rule (lib/createProgramValidation.ts) rejects the entire call
// because the echoed prescription violates the bodyweight invariant.
//
// The fix lives in the data layer (migration zero_bodyweight_weight zeros every
// such row). These two tests are the e2e validation at the handler layer:
//
//   (a) confirms the bug exists when the agent echoes a bodyweight prescription
//       with weight_kg=10 — the original failing scenario.
//   (b) confirms the same call succeeds once the echoed prescription matches the
//       post-migration data shape (weight_kg=0).
//
// Both run with the default dry_run, so no writes are exercised — the bug fires
// in validation, before any persistence happens.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// T164 — Circuit day replace (Unified Day Sequence wipe + insert)
// ---------------------------------------------------------------------------

Deno.test("T164: dry_run Circuit preview includes Circuit lines and writes nothing", async () => {
  const mock = new MockSupabase(makeBaseState())

  const reply = await updateProgram.handler(
    {
      program_id: ID_PROGRAM,
      days: [
        {
          id: ID_DAY_PUSH,
          label: "Push",
          emoji: "💪",
          exercises: [
            ID_BENCH,
            {
              type: "circuit",
              label: "Finisher",
              rounds: 3,
              exercises: [
                { exercise_id: ID_PUSHUP, amount: 10, weight_kg: 0 },
                { exercise_id: ID_BENCH, amount: 8, weight_kg: 60 },
              ],
            },
          ],
        },
        {
          id: ID_DAY_PULL,
          label: "Pull",
          emoji: "🪝",
          exercises: [ID_PUSHUP],
        },
      ],
    },
    mock as never,
  )

  assertEquals(reply.isError ?? false, false, JSON.stringify(reply.content))
  const text = reply.content[0].text
  assertStringIncludes(text, "Circuit")
  assertStringIncludes(text, "Finisher")
  assertEquals(writeOps(mock.callLog).length, 0)
  assertEquals(
    mock.callLog.filter((c) => c.op === "delete" || c.op === "insert").length,
    0,
  )
})

Deno.test(
  "T164: apply replaces day sequence — wipes orphan blocks and inserts Circuit",
  async () => {
    const state = makeBaseState()
    state.blocks.push({
      id: "orphan-block",
      workout_day_id: ID_DAY_PUSH,
      label: "Old Circuit",
      rounds: 2,
      sort_order: 1,
    })
    state.blockExercises.push({
      id: "orphan-be",
      block_id: "orphan-block",
      exercise_id: ID_PUSHUP,
      sort_order: 0,
    })
    const mock = new MockSupabase(state)

    const reply = await updateProgram.handler(
      {
        program_id: ID_PROGRAM,
        days: [
          {
            id: ID_DAY_PUSH,
            label: "Push",
            emoji: "💪",
            exercises: [
              {
                type: "circuit",
                label: "Finisher",
                rounds: 3,
                exercises: [
                  { exercise_id: ID_PUSHUP, amount: 10, weight_kg: 0 },
                  { exercise_id: ID_BENCH, amount: 8, weight_kg: 60 },
                ],
              },
            ],
          },
          {
            id: ID_DAY_PULL,
            label: "Pull",
            emoji: "🪝",
            exercises: [ID_PUSHUP],
          },
        ],
        dry_run: false,
      },
      mock as never,
    )

    assertEquals(reply.isError ?? false, false, JSON.stringify(reply.content))
    assertEquals(
      mock.state.blocks.some((b) => b.id === "orphan-block"),
      false,
      "orphan exercise_blocks row must be wiped",
    )
    const newBlock = mock.state.blocks.find((b) => b.workout_day_id === ID_DAY_PUSH)
    assertExists(newBlock)
    assertEquals(newBlock!.label, "Finisher")
    assertEquals(newBlock!.rounds, 3)

    const beInsert = mock.callLog.find(
      (e) => e.op === "insert" && e.table === "block_exercises",
    )
    assertExists(beInsert)
    const beRows = beInsert!.payload as Array<Record<string, unknown>>
    assertEquals(beRows.length, 2)
  },
)

Deno.test(
  "T164: catalog miss on nested Circuit exercise aborts before DELETE",
  async () => {
    const mock = new MockSupabase(makeBaseState())
    const missingId = "eeeeeeee-1111-4111-8111-eeeeeeeeeeee"

    const reply = await updateProgram.handler(
      {
        program_id: ID_PROGRAM,
        days: [
          {
            id: ID_DAY_PUSH,
            label: "Push",
            emoji: "💪",
            exercises: [
              {
                type: "circuit",
                label: "Broken",
                exercises: [
                  { exercise_id: ID_PUSHUP, amount: 10, weight_kg: 0 },
                  { exercise_id: missingId, amount: 8, weight_kg: 0 },
                ],
              },
            ],
          },
          {
            id: ID_DAY_PULL,
            label: "Pull",
            emoji: "🪝",
            exercises: [ID_PUSHUP],
          },
        ],
        dry_run: false,
      },
      mock as never,
    )

    assertEquals(reply.isError, true)
    const deletes = mock.callLog.filter(
      (c) =>
        c.op === "delete" &&
        (c.table === "workout_exercises" || c.table === "exercise_blocks"),
    )
    assertEquals(deletes.length, 0, "must not wipe day sequence on catalog miss")
  },
)

Deno.test(
  "update_program REJECTS a verbatim echo of a bodyweight day with weight_kg > 0 " +
    "(regression #320 — pre-migration data shape)",
  async () => {
    // Simulate the dirty-data state pre-migration: the bodyweight Push-up row
    // carries weight = '10'. An agent reading the program would echo this back
    // as weight_kg=10 inside update_program — exactly the trace #320 describes.
    const state = makeBaseState()
    const pushupRow = state.exercises.find((e) => e.exercise_id === ID_PUSHUP)
    assertExists(pushupRow)
    pushupRow!.weight = "10"

    const mock = new MockSupabase(state)
    const reply = await updateProgram.handler(
      {
        program_id: ID_PROGRAM,
        days: [
          // Echo Push as a bare UUID — bypasses object-form validation entirely.
          {
            id: ID_DAY_PUSH,
            label: "Push",
            emoji: "💪",
            exercises: [ID_BENCH],
          },
          // Echo Pull with the dirty bodyweight prescription as an object — this
          // is the exact shape the bug report shows the agent producing.
          {
            id: ID_DAY_PULL,
            label: "Pull",
            emoji: "🪝",
            exercises: [
              {
                exercise_id: ID_PUSHUP,
                sets: 3,
                reps: "10",
                weight_kg: 10,
                rest_seconds: 90,
              },
            ],
          },
        ],
      },
      mock as never,
    )

    assertEquals(reply.isError, true)
    const text = reply.content[0].text
    assertStringIncludes(text, 'days["Pull"].exercises[0]')
    assertStringIncludes(text, "bodyweight")
    assertStringIncludes(text, "Push-up")
    assertStringIncludes(text, "weight_kg")
    assertStringIncludes(text, "got 10")
    assertStringIncludes(text, "#281")
    // No writes in dry_run — guards against the day ever being persisted.
    assertEquals(writeOps(mock.callLog).length, 0)
  },
)

Deno.test(
  "update_program ACCEPTS a verbatim echo of the same bodyweight day once weight is 0 " +
    "(regression #320 — post-migration data shape)",
  async () => {
    // Post-migration: the bodyweight Push-up row's weight is '0' (unchanged
    // from the makeBaseState default). Echoing weight_kg=0 must round-trip
    // without R1 firing — proving the migration target shape unblocks the
    // original failing prompt.
    const mock = new MockSupabase(makeBaseState())
    const reply = await updateProgram.handler(
      {
        program_id: ID_PROGRAM,
        days: [
          {
            id: ID_DAY_PUSH,
            label: "Push",
            emoji: "💪",
            exercises: [ID_BENCH],
          },
          {
            id: ID_DAY_PULL,
            label: "Pull",
            emoji: "🪝",
            exercises: [
              {
                exercise_id: ID_PUSHUP,
                sets: 3,
                reps: "10",
                weight_kg: 0,
                rest_seconds: 90,
              },
            ],
          },
        ],
      },
      mock as never,
    )

    assertEquals(reply.isError ?? false, false)
    const body = parseReply(reply)
    assertEquals(body.dry_run, true)
    assertEquals(writeOps(mock.callLog).length, 0)
  },
)
