/**
 * Non-regression tests for the `get_exercise_details` MCP tool handler (T252, #288).
 *
 * Black-box: drives the registered handler with an in-memory mock supabase
 * scoped to the single chain the handler builds:
 *   - `from("exercises").select("*").eq("id", …).single()`
 * plus a defensive `auth.getUser()` so the mock stays shaped like a real client.
 *
 * The four cases freeze the #288 read-path guard exactly as merged in PR #543:
 * missing id, malformed id (verbatim message), well-formed UUID but no row,
 * and the happy path with a full catalog fixture row. The refactor to the
 * shared `isUuid` helper must keep all four green — if any of these fail, the
 * guard has regressed.
 */

import {
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import { toolRegistry } from "./registry.ts"
import { getExerciseDetails } from "./getExerciseDetails.ts"

// ---------------------------------------------------------------------------
// Fixtures (deterministic UUIDs)
// ---------------------------------------------------------------------------

const ID_USER = "11111111-1111-4111-8111-111111111111"
const ID_KROC = "dddddddd-3333-4333-8333-dddddddddddd"

interface ExerciseRow {
  id: string
  name: string
  name_en: string | null
  muscle_group: string
  secondary_muscles: string[] | null
  equipment: string
  difficulty_level: string | null
  measurement_type: "reps" | "duration"
  default_duration_seconds: number | null
  instructions: {
    setup: string[]
    movement: string[]
    breathing: string[]
    common_mistakes: string[]
  } | null
  instructions_en: null
  instructions_en_status: string | null
  image_url: string | null
  youtube_url: string | null
}

const KROC_ROW: ExerciseRow = {
  id: ID_KROC,
  name: "Rowing haltère prise neutre",
  name_en: "Kroc Row",
  muscle_group: "back",
  secondary_muscles: ["biceps", "traps"],
  equipment: "dumbbell",
  difficulty_level: "intermediate",
  measurement_type: "reps",
  default_duration_seconds: null,
  instructions: {
    setup: ["Set the dumbbell on the floor beside a bench."],
    movement: ["Hinge at the hips, row hard toward the hip."],
    breathing: ["Exhale on the pull."],
    common_mistakes: ["Using momentum from the torso."],
  },
  instructions_en: null,
  instructions_en_status: null,
  image_url: null,
  youtube_url: "https://www.youtube.com/watch?v=mock-kroc",
}

// ---------------------------------------------------------------------------
// MockSupabase — scoped to the chain get_exercise_details' handler builds.
// ---------------------------------------------------------------------------

interface CallEntry {
  table: string
  filters: Array<{ col: string; val: unknown }>
}

class MockSupabase {
  callLog: CallEntry[] = []

  constructor(
    public rowsByld: Map<string, ExerciseRow> = new Map([[ID_KROC, KROC_ROW]]),
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
}

class MockBuilder {
  private filters: Array<{ col: string; val: unknown }> = []

  constructor(private mock: MockSupabase, private table: string) {}

  select(_cols: string): this { // eslint-disable-line @typescript-eslint/no-unused-vars -- mirrors supabase query builder signature
    return this
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ col, val })
    return this
  }

  single(): Promise<{ data: unknown; error: unknown }> {
    this.mock.callLog.push({ table: this.table, filters: this.filters })

    const idFilter = this.filters.find((f) => f.col === "id")
    const row = idFilter ? this.mock.rowsByld.get(String(idFilter.val)) : undefined

    if (!row) {
      // Mirror PostgREST `.single()` on zero rows (PGRST116).
      return Promise.resolve({
        data: null,
        error: {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
        },
      })
    }
    return Promise.resolve({ data: row, error: null })
  }
}

function makeMock(rows: Map<string, ExerciseRow> = new Map()): MockSupabase {
  return new MockSupabase(rows)
}

// ---------------------------------------------------------------------------
// Registry posture — read-only tool, registered under its MCP name.
// ---------------------------------------------------------------------------

Deno.test("get_exercise_details is registered as a read-only idempotent tool", () => {
  const tool = toolRegistry.get("get_exercise_details")

  assertNotEquals(tool, null, "get_exercise_details must be registered in the tool registry")
  if (!tool) return

  assertEquals(tool.annotations.readOnlyHint, true, "read-only tool must declare readOnlyHint")
  assertEquals(tool.annotations.idempotentHint, true, "fetch-by-id is idempotent")
  assertEquals(typeof tool.annotations.title, "string")
})

// ---------------------------------------------------------------------------
// Guard case 1 — missing exercise_id.
// ---------------------------------------------------------------------------

Deno.test("missing exercise_id returns the required-id message and no DB call", async () => {
  const mock = makeMock()

  const result = await getExerciseDetails.handler({}, mock as unknown as SupabaseClient)

  assertEquals(result.isError, true, "missing id must surface as a tool error")
  assertEquals(
    result.content[0].text,
    "exercise_id is required. Use `resolve_exercises` (by name, preferred) or `search_exercises` (browse by filter) to find the UUID.",
  )
  assertEquals(
    mock.callLog.length,
    0,
    "missing id must be rejected before any catalog fetch",
  )
})

// ---------------------------------------------------------------------------
// Guard case 2 — malformed exercise_id. Message frozen VERBATIM from PR #543:
// any wording drift here is a regression of the #288 read-path guard.
// ---------------------------------------------------------------------------

Deno.test("malformed exercise_id returns the frozen verbatim format message", async () => {
  const mock = makeMock()

  const result = await getExerciseDetails.handler(
    { exercise_id: "kroc-row-id" },
    mock as unknown as SupabaseClient,
  )

  assertEquals(result.isError, true, "malformed id must surface as a tool error")
  assertEquals(
    result.content[0].text,
    'Invalid exercise_id format: "kroc-row-id". Expected a UUID — use `resolve_exercises` (by name) or `search_exercises` (browse) to find it.',
    "the malformed-id message is frozen verbatim by T252 — do not reword",
  )
  assertEquals(
    mock.callLog.length,
    0,
    "garbage input must fail fast before hitting Postgres (the whole point of guard #288)",
  )
})

// ---------------------------------------------------------------------------
// Guard case 3 — well-formed UUID but no such row.
// ---------------------------------------------------------------------------

Deno.test("valid UUID with no matching row returns Exercise not found", async () => {
  const mock = makeMock()
  const missingId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

  const result = await getExerciseDetails.handler(
    { exercise_id: missingId },
    mock as unknown as SupabaseClient,
  )

  assertEquals(result.isError, true, "missing row must surface as a tool error")
  assertEquals(
    result.content[0].text,
    `Exercise not found (id: ${missingId}). Try \`resolve_exercises\` with the name, or \`search_exercises\` to browse by filter.`,
  )
  assertEquals(mock.callLog.length, 1, "exactly one catalog fetch by id")
})

// ---------------------------------------------------------------------------
// Happy path — full catalog fixture row rendered as markdown.
// ---------------------------------------------------------------------------

Deno.test("valid UUID with a matching row renders formatted exercise details", async () => {
  const mock = makeMock(new Map([[ID_KROC, KROC_ROW]]))

  const result = await getExerciseDetails.handler(
    { exercise_id: ID_KROC },
    mock as unknown as SupabaseClient,
  )

  assertEquals(
    result.isError,
    undefined,
    `happy-path call must succeed; got: ${JSON.stringify(result.content)}`,
  )

  const text = result.content[0].text
  assertStringIncludes(text, "**Name:** Rowing haltère prise neutre (Kroc Row)")
  assertStringIncludes(text, "**Muscle group:** back")
  assertStringIncludes(text, "**Equipment:** dumbbell")
  assertStringIncludes(text, "**Measurement:** reps")
  // KROC_ROW ships non-null instructions, so the render must show them —
  // the "No instructions available." branch is the null-instructions case.
  assertStringIncludes(text, "**Setup**")
  assertStringIncludes(text, "Hinge at the hips, row hard toward the hip.")
  assertStringIncludes(text, "Using momentum from the torso.")
})
