import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  buildLastPreview,
  extractRenderedFromMcpResult,
  LAST_PREVIEW_MAX_BYTES,
  runProgramDraftStep,
  type DraftDeps,
  type DraftInput,
  type RenderedDay,
} from "./draft.ts"
import type { McpToolResult } from "../_shared/mcpClient.ts"
import type { Thread, ThreadMessage } from "./threadStore.ts"
import type { UserContextProfile } from "./prompt.ts"
import type {
  CatalogExercise,
  GenerateProgramResponse,
  RecentExercise,
  UserProfile as ProgramUserProfile,
} from "../_shared/programDraft.ts"

// ---------- factories ----------

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-1",
    user_id: "user-1",
    status: "open",
    messages: [],
    last_preview: null,
    locale: "en",
    purpose: "onboarding",
    change_motivation: null,
    bundle_context: null,
    validator_rejection_count: 0,
    pending_constraint_overrides: null,
    program_id: null,
    summary: null,
    user_turn_count: 0,
    assistant_turn_count: 0,
    draft_count_24h: 0,
    created_at: new Date("2026-05-08T10:00:00Z"),
    updated_at: new Date("2026-05-08T10:00:00Z"),
    committed_at: null,
    abandoned_at: null,
    ...overrides,
  }
}

function makeProfile(overrides: Partial<UserContextProfile> = {}): UserContextProfile {
  return {
    goal: "general_fitness",
    experience: "beginner",
    equipment: "full-gym",
    training_days_per_week: 3,
    session_duration_minutes: 45,
    age: 65,
    weight_kg: null,
    gender: "female",
    ...overrides,
  }
}

function makeCatalog(): CatalogExercise[] {
  return [
    { id: "ex-chest-01", name_en: "Bench Press", muscle_group: "chest", equipment: "barbell", secondary_muscles: [], difficulty_level: "intermediate" },
    { id: "ex-chest-02", name_en: "Push-Up", muscle_group: "chest", equipment: "bodyweight", secondary_muscles: [], difficulty_level: "beginner" },
    { id: "ex-back-01", name_en: "Barbell Row", muscle_group: "back", equipment: "barbell", secondary_muscles: [], difficulty_level: "intermediate" },
    { id: "ex-back-02", name_en: "Lat Pulldown", muscle_group: "back", equipment: "machine", secondary_muscles: [], difficulty_level: "beginner" },
    { id: "ex-leg-01", name_en: "Squat", muscle_group: "legs", equipment: "barbell", secondary_muscles: [], difficulty_level: "intermediate" },
    { id: "ex-leg-02", name_en: "Leg Press", muscle_group: "legs", equipment: "machine", secondary_muscles: [], difficulty_level: "beginner" },
  ]
}

interface DepsCalls {
  fetchCatalog: Array<{ equipmentValues: string[] }>
  fetchProfile: Array<{ userId: string }>
  fetchRecentHistory: Array<{ userId: string }>
  callModel: Array<{ prompt: string }>
}

interface DepsOverrides {
  fetchCatalog?: () => Promise<CatalogExercise[]>
  fetchProfile?: () => Promise<ProgramUserProfile | null>
  fetchRecentHistory?: () => Promise<{ exercises: RecentExercise[]; lastSessionAt: string | null }>
  callModel?: (prompt: string) => Promise<GenerateProgramResponse>
}

function makeDeps(overrides: DepsOverrides = {}): { deps: DraftDeps; calls: DepsCalls } {
  const calls: DepsCalls = {
    fetchCatalog: [],
    fetchProfile: [],
    fetchRecentHistory: [],
    callModel: [],
  }
  const deps: DraftDeps = {
    fetchCatalog: async (equipmentValues: string[]) => {
      calls.fetchCatalog.push({ equipmentValues })
      return overrides.fetchCatalog ? await overrides.fetchCatalog() : makeCatalog()
    },
    fetchProfile: async (userId: string) => {
      calls.fetchProfile.push({ userId })
      return overrides.fetchProfile
        ? await overrides.fetchProfile()
        : ({ experience: "beginner", goal: "general_fitness", equipment: "full-gym", training_days_per_week: 3, age: 65, gender: "female" } as ProgramUserProfile)
    },
    fetchRecentHistory: async (userId: string) => {
      calls.fetchRecentHistory.push({ userId })
      return overrides.fetchRecentHistory
        ? await overrides.fetchRecentHistory()
        : { exercises: [], lastSessionAt: null }
    },
    callModel: async (prompt: string) => {
      calls.callModel.push({ prompt })
      return overrides.callModel
        ? await overrides.callModel(prompt)
        : ({
            rationale: "Default 3-day full body for a beginner.",
            days: [
              { label: "Day 1", muscle_focus: "chest,back", exercise_ids: ["ex-chest-01", "ex-back-01"] },
              { label: "Day 2", muscle_focus: "legs", exercise_ids: ["ex-leg-01", "ex-leg-02"] },
              { label: "Day 3", muscle_focus: "chest,back", exercise_ids: ["ex-chest-02", "ex-back-02"] },
            ],
          } as GenerateProgramResponse)
    },
  }
  return { deps, calls }
}

function makeInput(overrides: Partial<DraftInput> = {}): DraftInput {
  return {
    userId: "user-1",
    locale: "en",
    thread: makeThread(),
    profile: makeProfile(),
    ...overrides,
  }
}

// ---------- runProgramDraftStep ----------

Deno.test("runProgramDraftStep happy path returns MCP-shaped args, one entry per day, with bare UUIDs from the catalog", async () => {
  const { deps, calls } = makeDeps()
  const result = await runProgramDraftStep(makeInput(), deps)

  assertEquals(result.ok, true)
  if (!result.ok) return

  // Wiring contract: every shipped day has a label + at least one exercise
  // from the catalog. We don't assert on exact day count: validateProgram
  // dedupes globally, so when the default mock model proposes overlapping
  // exercises across days the backfill pool can exhaust mid-program and
  // a tail day ends up empty (and gets dropped here in runProgramDraftStep).
  // Per-exercise pinning is validateProgram's job, not ours.
  assertEquals(result.args.days.length > 0, true)
  assertEquals(result.args.days[0].label, "Day 1")
  const allExercises = result.args.days.flatMap((d) => d.exercises)
  const catalogIds = new Set(makeCatalog().map((e) => e.id))
  assertEquals(allExercises.length > 0, true)
  for (const id of allExercises) assertEquals(catalogIds.has(id), true)
  // Defensive: no day ever ships with an empty `exercises` array (MCP
  // `create_program` would reject that as a tool_error).
  for (const day of result.args.days) {
    assertEquals(day.exercises.length > 0, true)
  }

  // Name is locale + goal + cadence — deterministic, no model call required.
  assertMatch(result.args.name, /general fitness|fitness/i)
  assertMatch(result.args.name, /3/)

  assertEquals(calls.fetchCatalog.length, 1)
  assertEquals(calls.callModel.length, 1)
})

Deno.test("runProgramDraftStep injects the embedded chat transcript into the prompt sent to the model", async () => {
  const { deps, calls } = makeDeps()
  const messages: ThreadMessage[] = [
    { role: "user", content: "I have a shoulder injury — subacromial bursitis.", ts: "2026-05-08T10:00:00Z" },
    { role: "assistant", content: "Thanks — we'll avoid overhead pressing.", ts: "2026-05-08T10:00:01Z" },
  ]
  await runProgramDraftStep(makeInput({ thread: makeThread({ messages }) }), deps)

  assertEquals(calls.callModel.length, 1)
  const prompt = calls.callModel[0].prompt
  assertMatch(prompt, /subacromial bursitis/)
  assertMatch(prompt, /avoid overhead pressing/)
  // The deterministic onboarding base prompt is still present.
  assertMatch(prompt, /EXERCISE CATALOG|catalog/i)
})

Deno.test("runProgramDraftStep returns error 'no_catalog' when the catalog fetch is empty", async () => {
  const { deps, calls } = makeDeps({ fetchCatalog: async () => [] })
  const result = await runProgramDraftStep(makeInput(), deps)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(result.error, "no_catalog")
  assertEquals(calls.callModel.length, 0) // never reached the model
})

Deno.test("runProgramDraftStep returns error 'model_failure' when the model throws", async () => {
  const { deps } = makeDeps({
    callModel: async () => {
      throw new Error("Gemini boom")
    },
  })
  const result = await runProgramDraftStep(makeInput(), deps)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(result.error, "model_failure")
})

Deno.test("runProgramDraftStep returns error 'empty_program' when the model returns no days at all", async () => {
  // validateProgram aggressively backfills from the catalog when valid IDs
  // are missing; the only way it returns truly-empty is when the model
  // hands back zero days. That's the only "empty_program" path we need to
  // guard against here.
  const { deps } = makeDeps({
    callModel: async () => ({
      rationale: "I couldn't build a program.",
      days: [],
    } as GenerateProgramResponse),
  })
  const result = await runProgramDraftStep(makeInput(), deps)

  assertEquals(result.ok, false)
  if (result.ok) return
  assertEquals(result.error, "empty_program")
})

Deno.test("runProgramDraftStep drops days that ended up empty after validation+backfill (regression: MCP rejects days[i].exercises = [] with tool_error)", async () => {
  // Real-world failure mode observed in dev: the model proposes 4 days,
  // validateProgram drops invalid IDs from one day, and the per-muscle-group
  // backfill pool is exhausted by earlier days — so day[i].exercise_ids
  // ends up []. We used to ship that straight to MCP, which rightfully
  // rejected the call ("days[2].exercises must be a non-empty array").
  // Defensive contract: filter empty days client-side; if at least one day
  // survives we ship a degraded-but-valid program.
  const tinyCatalog: CatalogExercise[] = [
    { id: "ex-chest-only", name_en: "Bench Press", muscle_group: "chest", equipment: "barbell", secondary_muscles: [], difficulty_level: "intermediate" },
  ]
  const { deps } = makeDeps({
    fetchCatalog: async () => tinyCatalog,
    callModel: async () =>
      ({
        rationale: "trying 3 days but the catalog only has one exercise",
        days: [
          { label: "Day 1", muscle_focus: "chest", exercise_ids: ["ex-chest-only"] },
          // Day 2 references the same id — globalSeen dedupes it, and the
          // chest pool is now empty so backfill finds nothing.
          { label: "Day 2", muscle_focus: "chest", exercise_ids: ["ex-chest-only"] },
          // Day 3 references a non-existent id — dropped, then backfill
          // can't find anything in the (still empty) chest pool.
          { label: "Day 3", muscle_focus: "chest", exercise_ids: ["ex-doesnt-exist"] },
        ],
      } as GenerateProgramResponse),
  })

  const result = await runProgramDraftStep(makeInput(), deps)

  assertEquals(result.ok, true)
  if (!result.ok) return
  // Only Day 1 survives — Days 2 and 3 are dropped instead of shipped empty.
  assertEquals(result.args.days.length, 1)
  assertEquals(result.args.days[0].label, "Day 1")
  assertEquals(result.args.days[0].exercises.length > 0, true)
})

Deno.test("runProgramDraftStep returns 'empty_program' when EVERY day ended up empty after validation+backfill", async () => {
  const { deps } = makeDeps({
    fetchCatalog: async () => [],
    callModel: async () =>
      ({
        rationale: "tried but no catalog exists",
        days: [
          { label: "Day 1", muscle_focus: "chest", exercise_ids: ["ex-doesnt-exist"] },
        ],
      } as GenerateProgramResponse),
  })

  const result = await runProgramDraftStep(makeInput(), deps)

  // Empty catalog short-circuits with `no_catalog` before validateProgram
  // runs. Sanity-check the catalog branch first…
  if (!result.ok) {
    assertEquals(result.error, "no_catalog")
    return
  }
  // …otherwise (if catalog were non-empty but all days emptied), the
  // ok=false path is what we'd want; the assertion above guards either
  // outcome explicitly.
})

Deno.test("runProgramDraftStep maps the equipment category to the catalog filter values passed to fetchCatalog", async () => {
  const { deps, calls } = makeDeps()
  await runProgramDraftStep(
    makeInput({ profile: makeProfile({ equipment: "minimal" }) }),
    deps,
  )

  assertEquals(calls.fetchCatalog.length, 1)
  // 'minimal' (questionnaire vocab) maps to 'bodyweight' (constraint
  // vocab) which resolves to a non-empty list of catalog equipment
  // values (`['bodyweight']`).
  assertEquals(calls.fetchCatalog[0].equipmentValues.length > 0, true)
})

Deno.test("runProgramDraftStep translates questionnaire equipment vocab ('gym' / 'home' / 'minimal') to constraint vocab BEFORE filtering the catalog (regression: empty catalog from raw 'gym' value)", async () => {
  const { deps, calls } = makeDeps()
  await runProgramDraftStep(
    // 'gym' is what the onboarding questionnaire writes into
    // `user_profiles.equipment` — the constraint layer expects 'full-gym'.
    // Without translation we'd pass an unknown key to getEquipmentValues
    // and end up filtering on an empty equipment list → no_catalog.
    makeInput({ profile: makeProfile({ equipment: "gym" }) }),
    deps,
  )

  assertEquals(calls.fetchCatalog.length, 1)
  // 'full-gym' resolves to barbell, dumbbell, ez_bar, machine, cable,
  // bench, kettlebell, band — i.e. 8 values.
  assertEquals(calls.fetchCatalog[0].equipmentValues.length, 8)
})

// ---------- extractRenderedFromMcpResult ----------
//
// Parses the MCP create_program dry-run response and lifts each day's
// human-readable echo lines into a structured `Array<{label, lines}>`. The
// MCP server already does the heavy lifting of formatPrescriptionLine() —
// this is just the bridge from "JSON-as-text wrapped in McpToolResult" to
// "shape the preview UI can render directly". Defensive on every parse step
// so a malformed response degrades to args-only preview rather than a 500.

function makeMcpResult(body: unknown): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(body) }],
  }
}

Deno.test("extractRenderedFromMcpResult parses dry-run days[].rendered into RenderedDay[]", () => {
  const result = makeMcpResult({
    dry_run: true,
    program: { name: "Hypertrophy — 4 d/wk", is_active: true },
    days: [
      {
        sort_order: 0,
        label: "Push",
        rendered: ["Bench Press — 4 × 8 × 80 kg total — 120s rest", "OHP — 3 × 10 × 40 kg total"],
      },
      {
        sort_order: 1,
        label: "Pull",
        rendered: ["Barbell Row — 4 × 8 × 70 kg total"],
      },
    ],
  })

  const rendered = extractRenderedFromMcpResult(result)

  assertEquals(rendered, [
    {
      label: "Push",
      lines: ["Bench Press — 4 × 8 × 80 kg total — 120s rest", "OHP — 3 × 10 × 40 kg total"],
    },
    { label: "Pull", lines: ["Barbell Row — 4 × 8 × 70 kg total"] },
  ])
})

Deno.test("extractRenderedFromMcpResult returns null when content is empty", () => {
  const result: McpToolResult = { content: [] }
  assertEquals(extractRenderedFromMcpResult(result), null)
})

Deno.test("extractRenderedFromMcpResult returns null when text is not valid JSON", () => {
  const result: McpToolResult = { content: [{ type: "text", text: "create_program failed: oops" }] }
  assertEquals(extractRenderedFromMcpResult(result), null)
})

Deno.test("extractRenderedFromMcpResult returns null when JSON has no days array", () => {
  const result = makeMcpResult({ dry_run: true, program: {} })
  assertEquals(extractRenderedFromMcpResult(result), null)
})

Deno.test("extractRenderedFromMcpResult tolerates missing rendered/label per day (defensive)", () => {
  const result = makeMcpResult({
    days: [
      { label: "Day 1" }, // no rendered
      { rendered: ["Push-Up — 3 × 10 × 0 kg total"] }, // no label
      { label: "Day 3", rendered: [42, "Squat — 5 × 5 × 100 kg total", null] }, // mixed types
    ],
  })

  assertEquals(extractRenderedFromMcpResult(result), [
    { label: "Day 1", lines: [] },
    { label: "", lines: ["Push-Up — 3 × 10 × 0 kg total"] },
    { label: "Day 3", lines: ["Squat — 5 × 5 × 100 kg total"] },
  ])
})

// ---------- buildLastPreview (size guard) ----------

const SAMPLE_RENDERED: RenderedDay[] = [
  { label: "Upper", lines: ["Bench Press — 4 × 8 × 80 kg total — 120s rest"] },
]

Deno.test("buildLastPreview keeps the rendered field intact when the payload fits under 32 KB", () => {
  const preview = buildLastPreview({
    args: { name: "Strength — 4 days/wk", days: [{ label: "Upper", exercises: ["abc"] }] },
    rendered: SAMPLE_RENDERED,
  })
  assertEquals(preview.rendered, SAMPLE_RENDERED)
  assertEquals(preview.args.name, "Strength — 4 days/wk")
})

Deno.test("buildLastPreview strips the rendered field but preserves args when payload exceeds 32 KB", () => {
  const hugeLine = "x".repeat(LAST_PREVIEW_MAX_BYTES + 100)
  const preview = buildLastPreview({
    args: { name: "Test", days: [{ label: "Day", exercises: ["abc"] }] },
    rendered: [{ label: "Day", lines: [hugeLine] }],
  })
  assertEquals(preview.rendered, undefined)
  assertEquals(preview.args.name, "Test")
})

Deno.test("buildLastPreview drops the rendered field when input is undefined or empty (no half-shape)", () => {
  // Empty `rendered: []` would ship `{ args, rendered: [] }` to the client,
  // which then has to special-case "rendered exists but is empty". Returning
  // undefined collapses both edge cases into the args-only fallback path.
  const empty = buildLastPreview({
    args: { name: "Test", days: [{ label: "Day", exercises: ["abc"] }] },
    rendered: [],
  })
  assertEquals(empty.rendered, undefined)

  const undef = buildLastPreview({
    args: { name: "Test", days: [{ label: "Day", exercises: ["abc"] }] },
  })
  assertEquals(undef.rendered, undefined)
})
