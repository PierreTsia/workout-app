/**
 * Integration tests for the `create_workout_day` MCP tool handler (T124, #342).
 *
 * Black-box: drives the registered handler with an in-memory mock supabase
 * scoped to the four chains the handler actually touches:
 *   - `auth.getUser()`
 *   - `from("exercises").select(...).in("id", [...])`
 *   - `from("workout_days").insert({...}).select("id").single()`
 *   - `from("workout_exercises").insert([...])`
 * Plus a defensive `from("programs").update(...)` recorder so the active-program
 * parity test (cycle 4) can assert the handler issues ZERO program writes.
 *
 * The mock is intentionally smaller than `updateProgram_test.ts`'s — that one
 * supports compensating-rollback flows we deliberately don't have here.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import { toolRegistry } from "./registry.ts"
import { createWorkoutDay } from "./createWorkoutDay.ts"

// ---------------------------------------------------------------------------
// Fixture ids (deterministic UUIDs)
// ---------------------------------------------------------------------------

const ID_USER = "11111111-1111-4111-8111-111111111111"
const ID_BENCH = "dddddddd-1111-4111-8111-dddddddddddd"
const ID_PUSHUP = "dddddddd-2222-4222-8222-dddddddddddd"

interface CatalogRow {
  id: string
  name: string
  muscle_group: string
  emoji: string | null
  equipment: string
  measurement_type: "reps" | "duration"
  default_duration_seconds: number | null
}

const BENCH: CatalogRow = {
  id: ID_BENCH,
  name: "Bench Press",
  muscle_group: "chest",
  emoji: null,
  equipment: "barbell",
  measurement_type: "reps",
  default_duration_seconds: null,
}

const PUSHUP: CatalogRow = {
  id: ID_PUSHUP,
  name: "Push-up",
  muscle_group: "chest",
  emoji: null,
  equipment: "bodyweight",
  measurement_type: "reps",
  default_duration_seconds: null,
}

// ---------------------------------------------------------------------------
// MockSupabase — scoped to the chains create_workout_day's handler builds.
// ---------------------------------------------------------------------------

interface CallEntry {
  op: "select" | "insert" | "update" | "delete"
  table: string
  payload?: unknown
  filters: Filter[]
  returning?: string
  terminal?: "single" | "maybeSingle"
}

interface Filter {
  type: "eq" | "in" | "is"
  col: string
  val: unknown
}

interface MockState {
  catalog: CatalogRow[]
}

class MockSupabase {
  callLog: CallEntry[] = []
  insertedDayCount = 0

  constructor(
    public state: MockState,
    public currentUserId: string = ID_USER,
  ) {}

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

  nextDayId(): string {
    this.insertedDayCount += 1
    return `mock-day-${this.insertedDayCount}`
  }
}

class MockBuilder {
  private entry: CallEntry
  private filters: Filter[] = []

  constructor(private mock: MockSupabase, private table: string) {
    this.entry = { op: "select", table, filters: [] }
  }

  select(cols: string): this {
    this.entry.returning = cols
    return this
  }

  insert(payload: unknown): this {
    this.entry.op = "insert"
    this.entry.payload = payload
    return this
  }

  update(payload: unknown): this {
    this.entry.op = "update"
    this.entry.payload = payload
    return this
  }

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

  single(): Promise<{ data: unknown; error: null }> {
    this.entry.terminal = "single"
    return this.execute()
  }

  maybeSingle(): Promise<{ data: unknown; error: null }> {
    this.entry.terminal = "maybeSingle"
    return this.execute()
  }

  // Thenable: enables `await builder` for chains without single/maybeSingle
  // (e.g. `from("workout_exercises").insert([...])` and bulk SELECTs).
  then<T1, T2>(
    onFulfilled: (v: { data: unknown; error: null }) => T1 | PromiseLike<T1>,
    onRejected?: (reason: unknown) => T2 | PromiseLike<T2>,
  ): Promise<T1 | T2> {
    return this.execute().then(onFulfilled, onRejected)
  }

  private async execute(): Promise<{ data: unknown; error: null }> {
    this.entry.filters = this.filters
    this.mock.callLog.push(this.entry)

    if (this.entry.op === "select" && this.table === "exercises") {
      const ids = this.filters.find((f) => f.type === "in" && f.col === "id")?.val as
        | string[]
        | undefined
      const rows = (ids ?? []).flatMap((id) => {
        const found = this.mock.state.catalog.find((e) => e.id === id)
        return found ? [found] : []
      })
      return { data: rows, error: null }
    }

    if (this.entry.op === "insert" && this.table === "workout_days") {
      const id = this.mock.nextDayId()
      // Handler chains `.insert(...).select("id").single()` — the resolved
      // value is the row, not an array.
      return { data: { id }, error: null }
    }

    if (this.entry.op === "insert" && this.table === "workout_exercises") {
      return { data: null, error: null }
    }

    // Defensive: any unexpected chain (e.g. handler accidentally writing to
    // `programs`) lands here so the cycle-4 parity assertion can spot it.
    return { data: null, error: null }
  }
}

function makeMock(): MockSupabase {
  return new MockSupabase({ catalog: [BENCH, PUSHUP] })
}

function dayInsertEntry(mock: MockSupabase): CallEntry | undefined {
  return mock.callLog.find((e) => e.op === "insert" && e.table === "workout_days")
}

Deno.test("create_workout_day is registered with non-destructive write annotations", () => {
  const tool = toolRegistry.get("create_workout_day")

  assertNotEquals(tool, null, "create_workout_day must be registered in the tool registry")
  if (!tool) return

  // Headline differentiator vs `create_program`: this tool MUST NOT be marked
  // destructive — it appends a workout day rather than deactivating the user's
  // active program. See ADR 0002 §3 for the rationale.
  assertEquals(
    tool.annotations.destructiveHint,
    false,
    "create_workout_day must declare destructiveHint: false (does not deactivate active programs)",
  )

  // It writes a row, so it isn't read-only either. The registry's existing
  // mutual-exclusion test (registry_test.ts) only catches the both-true case;
  // here we lock in the both-false posture for a tool that actually writes.
  assertEquals(
    Boolean(tool.annotations.readOnlyHint),
    false,
    "create_workout_day writes data and must not declare readOnlyHint",
  )

  // Required by the ToolAnnotations contract — "added a tool, forgot the
  // label" is the regression we're guarding against here at runtime
  // (TS already enforces the type shape).
  assertEquals(typeof tool.annotations.title, "string")
  assertEquals(
    tool.annotations.title.length > 0,
    true,
    "create_workout_day must have a non-empty annotations.title",
  )
})

// ---------------------------------------------------------------------------
// Cycle 2 — the workout_days row carries the locked Quick Workout shape.
// ---------------------------------------------------------------------------

Deno.test("write produces a workout_days row with locked Quick Workout fields", async () => {
  const mock = makeMock()

  const result = await createWorkoutDay.handler(
    {
      label: "Quick Push Day",
      exercises: [ID_BENCH, ID_PUSHUP],
      dry_run: false,
    },
    mock as unknown as SupabaseClient,
  )

  assertEquals(
    result.isError,
    undefined,
    `handler must succeed; got error content: ${JSON.stringify(result.content)}`,
  )

  const insert = dayInsertEntry(mock)
  assertExists(insert, "handler must insert exactly one workout_days row")

  const payload = insert.payload as Record<string, unknown>

  // Locked shape per ADR 0002 §3 + Tech Plan §"create_workout_day MCP tool".
  // These five fields are the entire reason the tool exists separately from
  // create_program — they encode "ad-hoc, standalone, live (not draft),
  // visually identifiable as a Quick Workout".
  assertEquals(payload.program_id, null, "Quick Workout days are NOT tied to a program")
  assertEquals(payload.label, "Quick Push Day", "label is taken verbatim from input")
  assertEquals(payload.emoji, "⚡", "Quick Workout days are hardcoded to ⚡ for visual identity")
  assertEquals(payload.sort_order, 0, "standalone day → sort_order 0 (no siblings)")
  assertEquals(
    payload.saved_at,
    null,
    "live workout (not a draft) → saved_at null; useCreateQuickWorkout owns drafts",
  )
  assertEquals(payload.user_id, ID_USER, "user_id sourced from auth, not input")
})

// ---------------------------------------------------------------------------
// Cycle 3 — workout_exercises rows: defaults for bare UUIDs, freeze for objects.
// ---------------------------------------------------------------------------

Deno.test("write produces workout_exercises rows: bare UUID gets defaults, object form freezes prescription", async () => {
  const mock = makeMock()

  const result = await createWorkoutDay.handler(
    {
      label: "Quick Push Day",
      exercises: [
        ID_BENCH,
        { exercise_id: ID_PUSHUP, sets: 4, reps: "8-12", weight_kg: 0, rest_seconds: 60 },
      ],
      dry_run: false,
    },
    mock as unknown as SupabaseClient,
  )

  assertEquals(
    result.isError,
    undefined,
    `handler must succeed; got error content: ${JSON.stringify(result.content)}`,
  )

  const exInsert = mock.callLog.find(
    (e) => e.op === "insert" && e.table === "workout_exercises",
  )
  assertExists(exInsert, "handler must insert workout_exercises rows")

  const rows = exInsert.payload as Array<Record<string, unknown>>
  assertEquals(rows.length, 2, "one row per exercise input")

  // Row 0 — bare UUID: catalog defaults (3 × 10, 0 kg, 90s rest). The
  // emoji_snapshot fallback is "🏋️" because BENCH.emoji is null.
  const bench = rows[0]
  assertEquals(bench.workout_day_id, "mock-day-1", "rows tied to the day we just inserted")
  assertEquals(bench.exercise_id, ID_BENCH)
  assertEquals(bench.name_snapshot, "Bench Press", "snapshot from catalog at create time")
  assertEquals(bench.sets, 3, "bare UUID applies default 3 sets")
  assertEquals(bench.reps, "10", "bare UUID applies default reps \"10\"")
  assertEquals(bench.weight, "0", "bare UUID applies default weight 0")
  assertEquals(bench.rest_seconds, 90, "bare UUID applies default 90s rest")
  assertEquals(bench.sort_order, 0, "first input → sort_order 0")

  // Row 1 — object form: prescription frozen verbatim. Bodyweight equipment
  // (PUSHUP) zeros out weight regardless of weight_kg input — the
  // buildWorkoutExerciseInsertRow bodyweight branch enforces this.
  const pushup = rows[1]
  assertEquals(pushup.exercise_id, ID_PUSHUP)
  assertEquals(pushup.name_snapshot, "Push-up")
  assertEquals(pushup.sets, 4, "object-form sets honored")
  assertEquals(pushup.reps, "8-12", "object-form reps honored")
  assertEquals(pushup.weight, "0", "bodyweight equipment forces weight 0")
  assertEquals(pushup.rest_seconds, 60, "object-form rest honored")
  assertEquals(pushup.sort_order, 1, "second input → sort_order 1")

  // Success envelope reflects the persisted exercise count.
  const envelope = JSON.parse(result.content[0].text) as {
    workout_day_id: string
    exercises_count: number
  }
  assertEquals(envelope.workout_day_id, "mock-day-1")
  assertEquals(envelope.exercises_count, 2)
})

// ---------------------------------------------------------------------------
// Cycle 4 — active-program parity guard.
// The headline differentiator vs `create_program` (ADR 0002 §3): this tool
// must NEVER touch the `programs` table. The agent surface contract relies on
// the user's active program staying active across Quick Workout calls.
// ---------------------------------------------------------------------------

Deno.test("does not issue any write to the programs table (active program stays active)", async () => {
  const mock = makeMock()

  const result = await createWorkoutDay.handler(
    { label: "Quick Day", exercises: [ID_BENCH], dry_run: false },
    mock as unknown as SupabaseClient,
  )

  assertEquals(result.isError, undefined, "happy-path call should succeed")

  const programWrites = mock.callLog.filter(
    (e) => e.table === "programs" && (e.op === "update" || e.op === "delete" || e.op === "insert"),
  )
  assertEquals(
    programWrites.length,
    0,
    `create_workout_day must not write to programs; got: ${JSON.stringify(programWrites)}`,
  )
})

// ---------------------------------------------------------------------------
// Cycle 6 — dry_run: true returns rendered prescription lines without writing.
// ---------------------------------------------------------------------------

Deno.test("dry_run: true returns rendered prescription lines and writes nothing", async () => {
  const mock = makeMock()

  const result = await createWorkoutDay.handler(
    {
      label: "Quick Push Day",
      exercises: [ID_BENCH, ID_PUSHUP],
      dry_run: true,
    },
    mock as unknown as SupabaseClient,
  )

  assertEquals(
    result.isError,
    undefined,
    `dry_run handler must succeed; got error content: ${JSON.stringify(result.content)}`,
  )

  // Zero writes — the whole point of dry_run is to preview before persisting.
  const writes = mock.callLog.filter(
    (e) => e.op === "insert" || e.op === "update" || e.op === "delete",
  )
  assertEquals(
    writes.length,
    0,
    `dry_run must not write; got: ${JSON.stringify(writes.map((w) => `${w.op} ${w.table}`))}`,
  )

  // Rendered prescription lines mention each exercise by name. The exact line
  // format is owned by `formatPrescriptionLine` and tested there; here we
  // just assert the dry_run response surfaces them.
  const text = result.content[0].text
  assertStringIncludes(text, "Bench Press", "rendered preview must include each exercise name")
  assertStringIncludes(text, "Push-up")
  assertStringIncludes(text, "\"dry_run\": true", "preview should signal dry_run mode in payload")
})

// ---------------------------------------------------------------------------
// Cycles 7-10 — validation surface.
// We don't re-test the full matrix from `createProgramValidation.test.ts`;
// we test that the handler RAISES on the four agent-facing error families and
// surfaces the message via `validateDayExercises` (not raw Postgres).
// ---------------------------------------------------------------------------

Deno.test("rejects missing label with structured error", async () => {
  const mock = makeMock()

  const result = await createWorkoutDay.handler(
    { exercises: [ID_BENCH], dry_run: false },
    mock as unknown as SupabaseClient,
  )

  assertEquals(result.isError, true, "missing label must surface as a tool error")
  assertStringIncludes(result.content[0].text.toLowerCase(), "label")

  const writes = mock.callLog.filter((e) => e.op !== "select")
  assertEquals(writes.length, 0, "rejection must not write")
})

Deno.test("rejects empty exercises[] with structured error", async () => {
  const mock = makeMock()

  const result = await createWorkoutDay.handler(
    { label: "Quick Day", exercises: [], dry_run: false },
    mock as unknown as SupabaseClient,
  )

  assertEquals(result.isError, true, "empty exercises must surface as a tool error")
  assertStringIncludes(result.content[0].text.toLowerCase(), "exercises")

  const writes = mock.callLog.filter((e) => e.op !== "select")
  assertEquals(writes.length, 0, "rejection must not write")
})

Deno.test("rejects > 20 exercises (Quick Workout cap, narrower than create_program)", async () => {
  const mock = makeMock()

  // 21 bare UUIDs — well-formed individually, but past the Quick Workout cap.
  // The cap is intentionally tighter than create_program's 40-per-day because
  // a Quick Workout is one ad-hoc session, not a multi-day plan.
  const overCap = Array.from({ length: 21 }, () => ID_BENCH)

  const result = await createWorkoutDay.handler(
    { label: "Quick Day", exercises: overCap, dry_run: false },
    mock as unknown as SupabaseClient,
  )

  assertEquals(result.isError, true, "21 exercises must surface as a tool error")
  assertStringIncludes(
    result.content[0].text,
    "20",
    "error message should name the cap so the agent knows the limit",
  )

  const writes = mock.callLog.filter((e) => e.op !== "select")
  assertEquals(writes.length, 0, "rejection must not write")
})

Deno.test("surfaces invalid UUID via validateDayExercises (not raw Postgres)", async () => {
  const mock = makeMock()

  const result = await createWorkoutDay.handler(
    { label: "Quick Day", exercises: ["not-a-uuid"], dry_run: false },
    mock as unknown as SupabaseClient,
  )

  assertEquals(result.isError, true, "invalid UUID input must surface as a tool error")

  const text = result.content[0].text
  // Locator-aware message from `validateDayExercises#parseExerciseInput`.
  // The handler wraps the validator's text with "Invalid input: " — see
  // `createProgramValidation.ts#parseExerciseInput`.
  assertStringIncludes(text, "Invalid UUID", "message must come from the shared validator")
  assertStringIncludes(text, "not-a-uuid", "message must echo the offending value")

  // Negative assertion: we do NOT want to leak the Postgres error verbatim.
  // `collectCandidateExerciseIds` filters non-UUIDs out of the IN clause
  // specifically so this never reaches the catalog fetch.
  assertEquals(
    text.toLowerCase().includes("invalid input syntax for type uuid"),
    false,
    "raw Postgres error must NOT leak to the agent",
  )

  const writes = mock.callLog.filter((e) => e.op !== "select")
  assertEquals(writes.length, 0, "rejection must not write")
})
