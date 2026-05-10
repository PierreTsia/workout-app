import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  fetchCatalog,
  fetchProfile,
  fetchRecentHistory,
} from "./programCatalog.ts"

// ---------------------------------------------------------------------------
// Minimal in-memory Supabase chain mock — captures what each helper needs:
//   fetchCatalog       : .from("exercises").select(...).in(equipment, [...]).order(...).order(...)
//   fetchProfile       : .from("user_profiles").select(...).eq(user_id, x).maybeSingle()
//   fetchRecentHistory : .from("sessions") + .from("set_logs") chains
// Each helper has a separate test, so I instantiate a fresh mock per case
// rather than juggling mode flags inside a single shared mock.
// ---------------------------------------------------------------------------

interface FromCall {
  table: string
}

interface CatalogMockOpts {
  rows?: Array<Record<string, unknown>>
  error?: { message: string } | null
}

// deno-lint-ignore no-explicit-any
function makeCatalogMock(opts: CatalogMockOpts): { client: any; calls: FromCall[] } {
  const calls: FromCall[] = []
  return {
    calls,
    client: {
      from(table: string) {
        calls.push({ table })
        const promise = Promise.resolve({
          data: opts.rows ?? [],
          error: opts.error ?? null,
        })
        const builder = {
          select: () => builder,
          in: () => builder,
          order: () => builder,
          then: promise.then.bind(promise),
        }
        return builder
      },
    },
  }
}

interface ProfileMockOpts {
  data?: Record<string, unknown> | null
  error?: { message: string } | null
}

// deno-lint-ignore no-explicit-any
function makeProfileMock(opts: ProfileMockOpts): { client: any; calls: FromCall[] } {
  const calls: FromCall[] = []
  return {
    calls,
    client: {
      from(table: string) {
        calls.push({ table })
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: () =>
            Promise.resolve({
              data: opts.data ?? null,
              error: opts.error ?? null,
            }),
        }
        return builder
      },
    },
  }
}

interface HistoryMockOpts {
  sessions?: Array<{ id: string; finished_at: string }>
  setLogs?: Array<{ exercise_id: string; exercise_name_snapshot: string }>
}

// deno-lint-ignore no-explicit-any
function makeHistoryMock(opts: HistoryMockOpts): { client: any; calls: FromCall[] } {
  const calls: FromCall[] = []
  return {
    calls,
    client: {
      from(table: string) {
        calls.push({ table })
        if (table === "sessions") {
          // chain ends on `.limit(5)` returning the sessions list
          const builder = {
            select: () => builder,
            eq: () => builder,
            not: () => builder,
            order: () => builder,
            limit: () =>
              Promise.resolve({ data: opts.sessions ?? [], error: null }),
          }
          return builder
        }
        // set_logs : .select(...).in(session_id, [...])
        const builder = {
          select: () => builder,
          in: () => Promise.resolve({ data: opts.setLogs ?? [], error: null }),
        }
        return builder
      },
    },
  }
}

// ---------------------------------------------------------------------------
// fetchCatalog
// ---------------------------------------------------------------------------

Deno.test("fetchCatalog hits the exercises table and returns the rows untouched", async () => {
  const rows = [
    {
      id: "ex-1",
      name_en: "Bench Press",
      muscle_group: "Pectoraux",
      equipment: "barbell",
      secondary_muscles: ["triceps"],
      difficulty_level: "intermediate",
    },
    {
      id: "ex-2",
      name_en: "Goblet Squat",
      muscle_group: "Jambes",
      equipment: "dumbbell",
      secondary_muscles: null,
      difficulty_level: "beginner",
    },
  ]
  const { client, calls } = makeCatalogMock({ rows })

  const result = await fetchCatalog(client, ["barbell", "dumbbell"])

  assertEquals(calls, [{ table: "exercises" }], "must hit exactly the exercises table")
  assertEquals(result, rows, "rows are returned untouched (no mapping)")
})

Deno.test("fetchCatalog returns [] when the database returns null data", async () => {
  // Postgrest returns `data: null` (not `[]`) for empty result sets in some
  // configurations. The helper coalesces to `[]` so callers don't deal with
  // a nullable shape.
  const { client } = makeCatalogMock({ rows: undefined })
  const result = await fetchCatalog(client, ["bodyweight"])
  assertEquals(result, [])
})

// ---------------------------------------------------------------------------
// fetchProfile
// ---------------------------------------------------------------------------

Deno.test("fetchProfile returns the row from user_profiles when one exists", async () => {
  const row = {
    experience: "intermediate",
    goal: "strength",
    equipment: "full-gym",
    training_days_per_week: 4,
    age: 32,
    gender: "male",
  }
  const { client, calls } = makeProfileMock({ data: row })

  const result = await fetchProfile(client, "user-1")

  assertEquals(calls, [{ table: "user_profiles" }])
  assertEquals(result, row)
})

Deno.test("fetchProfile returns null when no row exists", async () => {
  const { client } = makeProfileMock({ data: null })
  const result = await fetchProfile(client, "user-1")
  assertEquals(result, null)
})

// ---------------------------------------------------------------------------
// fetchRecentHistory
// ---------------------------------------------------------------------------

Deno.test("fetchRecentHistory returns empty result when the user has no finished sessions", async () => {
  const { client, calls } = makeHistoryMock({ sessions: [] })
  const result = await fetchRecentHistory(client, "user-1")
  assertEquals(result, { exercises: [], lastSessionAt: null })
  assertEquals(calls, [{ table: "sessions" }], "must short-circuit before hitting set_logs")
})

Deno.test("fetchRecentHistory dedupes exercises across sessions and stamps lastSessionAt from the most recent session", async () => {
  const { client, calls } = makeHistoryMock({
    sessions: [
      { id: "s1", finished_at: "2026-05-10T10:00:00Z" },
      { id: "s2", finished_at: "2026-05-09T10:00:00Z" },
    ],
    setLogs: [
      { exercise_id: "ex-bench", exercise_name_snapshot: "Bench Press" },
      { exercise_id: "ex-bench", exercise_name_snapshot: "Bench Press" }, // dup across sets
      { exercise_id: "ex-squat", exercise_name_snapshot: "Squat" },
      { exercise_id: "ex-bench", exercise_name_snapshot: "Bench Press" }, // dup across sessions
    ],
  })

  const result = await fetchRecentHistory(client, "user-1")

  assertEquals(result.lastSessionAt, "2026-05-10T10:00:00Z", "lastSessionAt = sessions[0].finished_at")
  assertEquals(
    result.exercises,
    [
      { exercise_id: "ex-bench", exercise_name_snapshot: "Bench Press" },
      { exercise_id: "ex-squat", exercise_name_snapshot: "Squat" },
    ],
    "duplicate exercise_ids are collapsed in first-seen order",
  )
  assertEquals(calls.map((c) => c.table), ["sessions", "set_logs"])
})
