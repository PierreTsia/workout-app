import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  appendMessage,
  buildDeterministicSummary,
  getOrCreateActiveThread,
  isRetentionDue,
  isStale,
  markStaleIfDue,
  purgeRetentionIfDue,
  resetForReject,
  setLastPreview,
  setStatus,
  type Thread,
} from "./threadStore.ts"
import type { UserContextProfile } from "./prompt.ts"

const ONE_DAY_MS = 24 * 60 * 60 * 1000

// ---------- fake Supabase client ----------
//
// Records every (table, op, values, filters) tuple. Tests assert on the
// recorded operations rather than on internal call shapes. We mimic only the
// chained surface threadStore actually uses: from(table).update(values).eq(col,val)
// and .select(...).eq(...).maybeSingle(). Anything beyond that is YAGNI.

type RecordedOp =
  | { kind: "update"; table: string; values: Record<string, unknown>; filters: Record<string, unknown> }
  | { kind: "insert"; table: string; values: Record<string, unknown>; returning?: boolean }
  | {
      kind: "select"
      table: string
      columns: string
      filters: Record<string, unknown>
      inFilters: Record<string, unknown[]>
      order?: { column: string; ascending: boolean }
      limit?: number
      final: "maybeSingle" | "single" | "list"
    }

type SingleResponse = { data: unknown; error: { code?: string; message?: string } | null }

interface FakeResponses {
  // Each op-type accepts either a single canned response (returned for every
  // call) or an array used as a queue (one per call, useful for race tests
  // where two SELECTs straddle a failed INSERT).
  selectMaybeSingle?: SingleResponse | SingleResponse[]
  selectSingle?: SingleResponse | SingleResponse[]
  insertSingle?: SingleResponse | SingleResponse[]
  updateSingle?: SingleResponse | SingleResponse[]
}

function takeNext<T>(value: T | T[] | undefined, fallback: T, counter: { n: number }): T {
  if (value === undefined) return fallback
  if (!Array.isArray(value)) return value
  const next = value[counter.n] ?? value[value.length - 1] ?? fallback
  counter.n += 1
  return next
}

function makeFakeSupabase(responses: FakeResponses = {}) {
  const ops: RecordedOp[] = []
  const counters = {
    selectMaybeSingle: { n: 0 },
    selectSingle: { n: 0 },
    insertSingle: { n: 0 },
    updateSingle: { n: 0 },
  }
  const defaultEmpty: SingleResponse = { data: null, error: null }

  function chain(table: string) {
    let pendingUpdate: Record<string, unknown> | null = null
    let pendingInsert: Record<string, unknown> | null = null
    let pendingSelect: { columns: string } | null = null
    const filters: Record<string, unknown> = {}
    const inFilters: Record<string, unknown[]> = {}
    let order: { column: string; ascending: boolean } | undefined
    let limit: number | undefined

    function recordSelect(final: "maybeSingle" | "single" | "list") {
      if (!pendingSelect) throw new Error("select missing")
      ops.push({
        kind: "select",
        table,
        columns: pendingSelect.columns,
        filters: { ...filters },
        inFilters: { ...inFilters },
        order,
        limit,
        final,
      })
    }

    const builder = {
      select(columns = "*") {
        pendingSelect = { columns }
        return builder
      },
      insert(values: Record<string, unknown>) {
        pendingInsert = values
        return builder
      },
      update(values: Record<string, unknown>) {
        pendingUpdate = values
        return builder
      },
      eq(col: string, val: unknown) {
        filters[col] = val
        return builder
      },
      in(col: string, vals: unknown[]) {
        inFilters[col] = vals
        return builder
      },
      order(column: string, opts: { ascending: boolean } = { ascending: true }) {
        order = { column, ascending: opts.ascending }
        return builder
      },
      limit(n: number) {
        limit = n
        return builder
      },
      maybeSingle() {
        if (pendingSelect) {
          recordSelect("maybeSingle")
          return Promise.resolve(
            takeNext(responses.selectMaybeSingle, defaultEmpty, counters.selectMaybeSingle),
          )
        }
        throw new Error("maybeSingle without select")
      },
      single() {
        // insert.select(...).single() and update.select(...).single() are
        // RETURNING-style chains: prioritize the write op over the trailing
        // select so the right canned response is returned.
        if (pendingInsert) {
          ops.push({
            kind: "insert",
            table,
            values: pendingInsert,
            returning: true,
          })
          return Promise.resolve(
            takeNext(responses.insertSingle, defaultEmpty, counters.insertSingle),
          )
        }
        if (pendingUpdate) {
          ops.push({
            kind: "update",
            table,
            values: pendingUpdate,
            filters: { ...filters },
          })
          return Promise.resolve(
            takeNext(responses.updateSingle, defaultEmpty, counters.updateSingle),
          )
        }
        if (pendingSelect) {
          recordSelect("single")
          return Promise.resolve(
            takeNext(responses.selectSingle, defaultEmpty, counters.selectSingle),
          )
        }
        throw new Error("single without select/insert/update")
      },
      // bare-update (no .single()) — recognised when await is reached without single()
      then(resolve: (v: unknown) => void) {
        if (pendingUpdate) {
          ops.push({
            kind: "update",
            table,
            values: pendingUpdate,
            filters: { ...filters },
          })
          resolve(takeNext(responses.updateSingle, defaultEmpty, counters.updateSingle))
          return
        }
        resolve(undefined)
      },
    }
    return builder
  }

  const supabase = {
    from(table: string) {
      return chain(table)
    },
  }

  return { supabase, ops }
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-1",
    user_id: "user-1",
    status: "open",
    messages: [],
    last_preview: null,
    locale: "en",
    program_id: null,
    summary: null,
    user_turn_count: 0,
    assistant_turn_count: 0,
    draft_count_24h: 0,
    created_at: new Date("2026-05-01T10:00:00Z"),
    updated_at: new Date("2026-05-01T10:00:00Z"),
    committed_at: null,
    abandoned_at: null,
    ...overrides,
  }
}

Deno.test("isStale returns true when updated_at is older than 7 days", () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const eightDaysAgo = new Date(now - 8 * ONE_DAY_MS)
  assertEquals(isStale(eightDaysAgo, now), true)
})

Deno.test("isStale returns false when updated_at is exactly 7 days old (boundary)", () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const sevenDaysAgo = new Date(now - 7 * ONE_DAY_MS)
  assertEquals(isStale(sevenDaysAgo, now), false)
})

Deno.test("isStale returns false when updated_at is 6 days old", () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const sixDaysAgo = new Date(now - 6 * ONE_DAY_MS)
  assertEquals(isStale(sixDaysAgo, now), false)
})

// Regression: supabase-js returns timestamptz columns as ISO strings, not
// Date objects. The `Thread` shape returned from `from(...).select()` therefore
// has string timestamps. Helpers must accept both so the prod code path
// doesn't blow up the first time we resume an active thread.
Deno.test("isStale accepts an ISO string updated_at (matches supabase-js wire shape)", () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const eightDaysAgoIso = new Date(now - 8 * ONE_DAY_MS).toISOString()
  assertEquals(isStale(eightDaysAgoIso, now), true)
})

Deno.test("markStaleIfDue accepts an ISO string updated_at (matches supabase-js wire shape)", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const stale = makeThread({
    status: "open",
    updated_at: new Date(now - 8 * ONE_DAY_MS).toISOString() as unknown as Date,
  })
  const { supabase } = makeFakeSupabase()

  const result = await markStaleIfDue(supabase, stale, now)

  assertEquals(result.stale, true)
})

Deno.test("isRetentionDue returns true past 90 days", () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const ninetyOneDaysAgo = new Date(now - 91 * ONE_DAY_MS)
  assertEquals(isRetentionDue(ninetyOneDaysAgo, now), true)
})

Deno.test("isRetentionDue returns false at exactly 90 days (boundary)", () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const ninetyDaysAgo = new Date(now - 90 * ONE_DAY_MS)
  assertEquals(isRetentionDue(ninetyDaysAgo, now), false)
})

Deno.test("isRetentionDue returns false for null (no commit / abandon timestamp)", () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  assertEquals(isRetentionDue(null, now), false)
})

// ---------- appendMessage ----------

Deno.test("appendMessage(user) pushes the message and bumps user_turn_count", async () => {
  const { supabase, ops } = makeFakeSupabase()
  const thread = makeThread({ messages: [], user_turn_count: 0, assistant_turn_count: 0 })

  await appendMessage(supabase, thread, "user", "hello there")

  const updates = ops.filter((o) => o.kind === "update")
  assertEquals(updates.length, 1)
  const op = updates[0]
  if (op.kind !== "update") throw new Error("expected update op")
  assertEquals(op.table, "embedded_agent_threads")
  assertEquals(op.filters, { id: "thread-1" })

  const messages = op.values.messages as Array<{ role: string; content: string; ts: string }>
  assertEquals(messages.length, 1)
  assertEquals(messages[0].role, "user")
  assertEquals(messages[0].content, "hello there")
  assertEquals(typeof messages[0].ts, "string")

  assertEquals(op.values.user_turn_count, 1)
  assertEquals(op.values.assistant_turn_count, 0)
})

// ---------- getOrCreateActiveThread ----------

Deno.test("getOrCreateActiveThread resumes via re-select when insert hits the partial-unique race (23505)", async () => {
  // Two-tab race: select sees nothing, insert collides with the partial
  // unique index, follow-up select pulls the row the other tab inserted.
  const concurrentRow = makeThread({ id: "thread-other-tab", user_id: "user-1" })
  const { supabase, ops } = makeFakeSupabase({
    selectMaybeSingle: [
      { data: null, error: null }, // initial probe — nothing there
      { data: concurrentRow, error: null }, // post-conflict re-probe
    ],
    insertSingle: { data: null, error: { code: "23505", message: "duplicate key" } },
  })

  const { thread, resumed } = await getOrCreateActiveThread(supabase, "user-1", "en")

  assertEquals(resumed, true)
  assertEquals(thread.id, "thread-other-tab")
  assertEquals(ops.filter((o) => o.kind === "select").length, 2)
  assertEquals(ops.filter((o) => o.kind === "insert").length, 1)
})

Deno.test("getOrCreateActiveThread inserts a fresh 'open' row when no active thread exists", async () => {
  const inserted = makeThread({
    id: "thread-new",
    user_id: "user-1",
    status: "open",
    locale: "fr",
  })
  const { supabase, ops } = makeFakeSupabase({
    selectMaybeSingle: { data: null, error: null },
    insertSingle: { data: inserted, error: null },
  })

  const { thread, resumed } = await getOrCreateActiveThread(supabase, "user-1", "fr")

  assertEquals(resumed, false)
  assertEquals(thread.id, "thread-new")

  const inserts = ops.filter((o) => o.kind === "insert")
  assertEquals(inserts.length, 1)
  const ins = inserts[0]
  if (ins.kind !== "insert") throw new Error("expected insert op")
  assertEquals(ins.table, "embedded_agent_threads")
  assertEquals(ins.values, {
    user_id: "user-1",
    status: "open",
    locale: "fr",
  })
})

Deno.test("getOrCreateActiveThread resumes an existing active row when one exists", async () => {
  const existing = makeThread({
    id: "thread-existing",
    user_id: "user-1",
    status: "open",
  })
  const { supabase, ops } = makeFakeSupabase({
    selectMaybeSingle: { data: existing, error: null },
  })

  const { thread, resumed } = await getOrCreateActiveThread(supabase, "user-1", "en")

  assertEquals(resumed, true)
  assertEquals(thread.id, "thread-existing")

  const selects = ops.filter((o) => o.kind === "select")
  assertEquals(selects.length, 1)
  const sel = selects[0]
  if (sel.kind !== "select") throw new Error("expected select op")
  assertEquals(sel.table, "embedded_agent_threads")
  assertEquals(sel.filters, { user_id: "user-1" })
  assertEquals(sel.inFilters, { status: ["open", "preview_ready"] })

  const inserts = ops.filter((o) => o.kind === "insert")
  assertEquals(inserts.length, 0)
})

// ---------- markStaleIfDue ----------

Deno.test("markStaleIfDue abandons an 'open' thread older than 7 days", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const stale = makeThread({
    status: "open",
    updated_at: new Date(now - 8 * ONE_DAY_MS),
  })
  const { supabase, ops } = makeFakeSupabase()

  const result = await markStaleIfDue(supabase, stale, now)

  assertEquals(result.stale, true)
  const op = ops.filter((o) => o.kind === "update")[0]
  if (op.kind !== "update") throw new Error("expected update op")
  assertEquals(op.values.status, "abandoned")
  assertEquals(typeof op.values.abandoned_at, "string")
})

Deno.test("markStaleIfDue is a no-op for a fresh 'open' thread", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const fresh = makeThread({
    status: "open",
    updated_at: new Date(now - 3 * ONE_DAY_MS),
  })
  const { supabase, ops } = makeFakeSupabase()

  const result = await markStaleIfDue(supabase, fresh, now)

  assertEquals(result.stale, false)
  assertEquals(ops.length, 0)
})

Deno.test("markStaleIfDue is a no-op for non-'open' statuses even if old", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const oldPreviewReady = makeThread({
    status: "preview_ready",
    updated_at: new Date(now - 8 * ONE_DAY_MS),
  })
  const { supabase, ops } = makeFakeSupabase()

  const result = await markStaleIfDue(supabase, oldPreviewReady, now)

  assertEquals(result.stale, false)
  assertEquals(ops.length, 0)
})

// ---------- purgeRetentionIfDue ----------

Deno.test("purgeRetentionIfDue clears messages on a committed thread past 90 days", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const committed = makeThread({
    status: "committed",
    committed_at: new Date(now - 91 * ONE_DAY_MS),
    messages: [{ role: "user", content: "hi", ts: "x" }],
  })
  const { supabase, ops } = makeFakeSupabase()

  const result = await purgeRetentionIfDue(supabase, committed, now)

  assertEquals(result.purged, true)
  const op = ops.filter((o) => o.kind === "update")[0]
  if (op.kind !== "update") throw new Error("expected update op")
  assertEquals(op.values.messages, null)
  assertEquals(op.filters, { id: "thread-1" })
})

Deno.test("purgeRetentionIfDue is a no-op when retention window not reached", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const recent = makeThread({
    status: "committed",
    committed_at: new Date(now - 30 * ONE_DAY_MS),
    messages: [{ role: "user", content: "hi", ts: "x" }],
  })
  const { supabase, ops } = makeFakeSupabase()

  const result = await purgeRetentionIfDue(supabase, recent, now)

  assertEquals(result.purged, false)
  assertEquals(ops.length, 0)
})

Deno.test("purgeRetentionIfDue applies retention to abandoned threads too", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const abandonedOld = makeThread({
    status: "abandoned",
    committed_at: null,
    abandoned_at: new Date(now - 91 * ONE_DAY_MS),
    messages: [{ role: "user", content: "hi", ts: "x" }],
  })
  const { supabase, ops } = makeFakeSupabase()

  const result = await purgeRetentionIfDue(supabase, abandonedOld, now)

  assertEquals(result.purged, true)
  const op = ops.filter((o) => o.kind === "update")[0]
  if (op.kind !== "update") throw new Error("expected update op")
  assertEquals(op.values.messages, null)
})

Deno.test("purgeRetentionIfDue is a no-op when messages already null (idempotent)", async () => {
  const now = new Date("2026-05-08T12:00:00Z").getTime()
  const purged = makeThread({
    status: "committed",
    committed_at: new Date(now - 200 * ONE_DAY_MS),
    messages: null,
  })
  const { supabase, ops } = makeFakeSupabase()

  const result = await purgeRetentionIfDue(supabase, purged, now)

  assertEquals(result.purged, false)
  assertEquals(ops.length, 0)
})

// ---------- setLastPreview ----------

Deno.test("setLastPreview writes the JSON payload to last_preview and bumps updated_at", async () => {
  const { supabase, ops } = makeFakeSupabase()
  const thread = makeThread()
  const payload = { args: { name: "Push/Pull 4d" }, rendered: ["Bench — 4×8"] }

  await setLastPreview(supabase, thread, payload)

  const op = ops.filter((o) => o.kind === "update")[0]
  if (op.kind !== "update") throw new Error("expected update op")
  assertEquals(op.table, "embedded_agent_threads")
  assertEquals(op.filters, { id: "thread-1" })
  assertEquals(op.values.last_preview, payload)
  assertEquals(typeof op.values.updated_at, "string")
})

// ---------- setStatus ----------

Deno.test("setStatus('committed') clears messages and writes program_id + summary + committed_at", async () => {
  const { supabase, ops } = makeFakeSupabase()
  const thread = makeThread({
    status: "preview_ready",
    messages: [{ role: "user", content: "hi", ts: "2026-05-08T10:00:00.000Z" }],
  })

  await setStatus(supabase, thread, "committed", {
    program_id: "prog-1",
    summary: "Onboarding summary",
  })

  const updates = ops.filter((o) => o.kind === "update")
  assertEquals(updates.length, 1)
  const op = updates[0]
  if (op.kind !== "update") throw new Error("expected update op")
  assertEquals(op.table, "embedded_agent_threads")
  assertEquals(op.filters, { id: "thread-1" })
  assertEquals(op.values.status, "committed")
  assertEquals(op.values.messages, null)
  assertEquals(op.values.program_id, "prog-1")
  assertEquals(op.values.summary, "Onboarding summary")
  assertEquals(typeof op.values.committed_at, "string")
})

Deno.test("setStatus('abandoned') writes abandoned_at without clearing messages", async () => {
  const { supabase, ops } = makeFakeSupabase()
  const thread = makeThread({
    status: "open",
    messages: [{ role: "user", content: "hi", ts: "2026-05-08T10:00:00.000Z" }],
  })

  await setStatus(supabase, thread, "abandoned")

  const op = ops.filter((o) => o.kind === "update")[0]
  if (op.kind !== "update") throw new Error("expected update op")
  assertEquals(op.values.status, "abandoned")
  assertEquals(typeof op.values.abandoned_at, "string")
  assertEquals("messages" in op.values, false)
})

Deno.test("setStatus('preview_ready') only updates the status (no terminal timestamps)", async () => {
  const { supabase, ops } = makeFakeSupabase()
  const thread = makeThread({ status: "open" })

  await setStatus(supabase, thread, "preview_ready")

  const op = ops.filter((o) => o.kind === "update")[0]
  if (op.kind !== "update") throw new Error("expected update op")
  assertEquals(op.values.status, "preview_ready")
  assertEquals("committed_at" in op.values, false)
  assertEquals("abandoned_at" in op.values, false)
  assertEquals("messages" in op.values, false)
})

// ---------- resetForReject ----------
//
// Atomically transitions a `preview_ready` thread back to `open` and drops
// `last_preview`. The combined update is intentional: split into two queries
// the route would race on a hot reload (preview cleared, status still
// preview_ready → client lands on a blank preview screen).

Deno.test("resetForReject updates status, clears last_preview, and bumps updated_at in one query", async () => {
  const { supabase, ops } = makeFakeSupabase()
  const thread = makeThread({
    status: "preview_ready",
    last_preview: { args: { name: "Stub", days: [] } } as Record<string, unknown>,
  })

  await resetForReject(supabase, thread)

  const updates = ops.filter((o) => o.kind === "update")
  assertEquals(updates.length, 1)
  const op = updates[0]
  if (op.kind !== "update") throw new Error("expected update op")
  assertEquals(op.table, "embedded_agent_threads")
  assertEquals(op.filters, { id: "thread-1" })
  assertEquals(op.values.status, "open")
  assertEquals(op.values.last_preview, null)
  assertEquals(typeof op.values.updated_at, "string")
})

// ---------- buildDeterministicSummary ----------
//
// Pure-function block — no Supabase chain involved. The summary string is what
// /commit writes into `embedded_agent_threads.summary` once the user confirms
// the AI program. It survives raw-transcript purge (T116 retention sweep) and
// becomes the long-tail audit trail for "how did this program get created?",
// so a deterministic, model-call-free composer is a hard requirement.

const PROFILE_GYM: UserContextProfile = {
  goal: "hypertrophy",
  experience: "intermediate",
  equipment: "gym",
  training_days_per_week: 4,
  session_duration_minutes: 60,
  age: 32,
  weight_kg: 78,
  gender: "male",
}

Deno.test("buildDeterministicSummary EN renders profile + program shape without signals", () => {
  const summary = buildDeterministicSummary({
    locale: "en",
    profile: PROFILE_GYM,
    programDays: 4,
    programExerciseCount: 24,
  })

  assertEquals(
    summary,
    "AI onboarding program created. Goal: Hypertrophy · 4 d/wk · 60 min · gym. Program: 4 days, 24 exercises.",
  )
})

Deno.test("buildDeterministicSummary EN appends Notable input from chat when signals are present", () => {
  const summary = buildDeterministicSummary({
    locale: "en",
    profile: PROFILE_GYM,
    programDays: 4,
    programExerciseCount: 24,
    signals: ["shoulder injury", "no overhead press"],
  })

  assertEquals(
    summary,
    "AI onboarding program created. Goal: Hypertrophy · 4 d/wk · 60 min · gym. Notable input from chat: shoulder injury, no overhead press. Program: 4 days, 24 exercises.",
  )
})

Deno.test("buildDeterministicSummary skips Notable input when signals is an empty array", () => {
  // Note: cadence on the first line comes from profile (user *intent*), while
  // "Program: N days" comes from the actual draft (what got built). They can
  // diverge if the model proposes a different shape — the summary captures
  // both facts distinctly rather than picking a winner.
  const summary = buildDeterministicSummary({
    locale: "en",
    profile: PROFILE_GYM,
    programDays: 3,
    programExerciseCount: 15,
    signals: [],
  })

  assertEquals(
    summary,
    "AI onboarding program created. Goal: Hypertrophy · 4 d/wk · 60 min · gym. Program: 3 days, 15 exercises.",
  )
})

Deno.test("buildDeterministicSummary FR translates labels and uses jours/sem cadence", () => {
  const summary = buildDeterministicSummary({
    locale: "fr",
    profile: { ...PROFILE_GYM, goal: "strength", equipment: "home" },
    programDays: 3,
    programExerciseCount: 18,
    signals: ["genou sensible"],
  })

  assertEquals(
    summary,
    "Programme créé via l'agent IA. Objectif : Force · 4 j/sem · 60 min · maison. Apport notable du chat : genou sensible. Programme : 3 jours, 18 exercices.",
  )
})

Deno.test("buildDeterministicSummary is deterministic — same input always returns the same string", () => {
  // Property guard: this string lives forever in the audit trail. If we ever
  // sneak a `Date.now()` or `Math.random()` into the implementation this test
  // catches it before the row contents start drifting between commits.
  const input = {
    locale: "en" as const,
    profile: PROFILE_GYM,
    programDays: 4,
    programExerciseCount: 24,
    signals: ["shoulder injury"],
  }
  assertEquals(
    buildDeterministicSummary(input),
    buildDeterministicSummary(input),
  )
})

Deno.test("buildDeterministicSummary falls back to raw values for unknown goal/equipment", () => {
  // Defensive against future profile schema additions: unknown values get
  // surfaced verbatim instead of crashing or printing "undefined". The
  // alternative — throwing — would break /commit on a perfectly valid program
  // just because we haven't shipped a label yet.
  const summary = buildDeterministicSummary({
    locale: "en",
    profile: { ...PROFILE_GYM, goal: "powerlifting", equipment: "garage" },
    programDays: 4,
    programExerciseCount: 24,
  })

  assertEquals(
    summary,
    "AI onboarding program created. Goal: powerlifting · 4 d/wk · 60 min · garage. Program: 4 days, 24 exercises.",
  )
})

// ---------- appendMessage ----------

Deno.test("appendMessage(assistant) bumps assistant_turn_count and preserves prior messages", async () => {
  const { supabase, ops } = makeFakeSupabase()
  const prior = [
    { role: "user" as const, content: "hi", ts: "2026-05-08T10:00:00.000Z" },
  ]
  const thread = makeThread({
    messages: prior,
    user_turn_count: 1,
    assistant_turn_count: 0,
  })

  await appendMessage(supabase, thread, "assistant", "salut")

  const updates = ops.filter((o) => o.kind === "update")
  const op = updates[0]
  if (op.kind !== "update") throw new Error("expected update op")
  const messages = op.values.messages as Array<{ role: string; content: string; ts: string }>
  assertEquals(messages.length, 2)
  assertEquals(messages[1].role, "assistant")
  assertEquals(messages[1].content, "salut")
  assertEquals(typeof messages[1].ts, "string")
  assertEquals(op.values.assistant_turn_count, 1)
  assertEquals(op.values.user_turn_count, 1)
})
