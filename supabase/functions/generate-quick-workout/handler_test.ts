// Behavioral tests for the generate-quick-workout handler (T127, #342).
// Deps-injected so each test isolates a single concern: auth, validation,
// quota gate, log_everything, structured logging, equipment allowlist.
//
// Mirrors the deps-factory pattern from `embedded-agent/handler_test.ts` —
// `makeDeps()` returns a recorder that tracks every dep invocation; tests
// pass `overrides` to inject failures or assertable return values.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  handleGenerateQuickWorkout,
  type GenerateQuickWorkoutDeps,
  type LogEvent,
} from "./handler.ts"
import type {
  CatalogExercise,
  RecentExercise,
  UserProfile,
} from "../_shared/programCatalog.ts"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER = { userId: "user-1", email: "u@gymlogic.app" } as const

const CATALOG: CatalogExercise[] = [
  {
    id: "ex-bench",
    name_en: "Bench Press",
    muscle_group: "Pectoraux",
    equipment: "barbell",
    secondary_muscles: ["triceps"],
    difficulty_level: "intermediate",
  },
  {
    id: "ex-row",
    name_en: "Barbell Row",
    muscle_group: "Dos",
    equipment: "barbell",
    secondary_muscles: null,
    difficulty_level: "intermediate",
  },
  {
    id: "ex-curl",
    name_en: "Biceps Curl",
    muscle_group: "Biceps",
    equipment: "dumbbell",
    secondary_muscles: null,
    difficulty_level: "beginner",
  },
  {
    id: "ex-press",
    name_en: "Overhead Press",
    muscle_group: "Épaules",
    equipment: "barbell",
    secondary_muscles: ["triceps"],
    difficulty_level: "intermediate",
  },
  {
    id: "ex-squat",
    name_en: "Squat",
    muscle_group: "Jambes",
    equipment: "barbell",
    secondary_muscles: ["fessiers"],
    difficulty_level: "intermediate",
  },
]

const PROFILE: UserProfile = {
  experience: "intermediate",
  goal: "strength",
  equipment: "full-gym",
  training_days_per_week: 4,
  age: 32,
  gender: "male",
}

const HISTORY: { exercises: RecentExercise[]; lastSessionAt: string | null } = {
  exercises: [{ exercise_id: "ex-bench", exercise_name_snapshot: "Bench Press" }],
  lastSessionAt: "2026-05-09T10:00:00Z",
}

// ---------------------------------------------------------------------------
// Deps factory — records every call and resolves with sane defaults.
// ---------------------------------------------------------------------------

interface DepsCalls {
  getUser: Array<{ authHeader: string }>
  checkQuota: Array<{ userId: string; email: string | null }>
  fetchCatalog: Array<{ equipmentValues: string[]; muscleGroupFilter?: string[] }>
  fetchProfile: Array<{ userId: string }>
  fetchRecentHistory: Array<{ userId: string }>
  callGemini: Array<{ prompt: string }>
  logBillableCall: Array<{ userId: string }>
  logEvents: LogEvent[]
}

interface DepsOverrides {
  getUser?: (authHeader: string) => Promise<{ userId: string; email: string | null } | null>
  checkQuota?: (userId: string, email: string | null) => Promise<{ allowed: boolean }>
  fetchCatalog?: (
    equipmentValues: string[],
    muscleGroupFilter?: string[],
  ) => Promise<CatalogExercise[]>
  callGemini?: (prompt: string) => Promise<{ exerciseIds: string[]; rationale: string }>
  logBillableCall?: (userId: string) => Promise<void>
}

function makeDeps(overrides: DepsOverrides = {}): { deps: GenerateQuickWorkoutDeps; calls: DepsCalls } {
  const calls: DepsCalls = {
    getUser: [],
    checkQuota: [],
    fetchCatalog: [],
    fetchProfile: [],
    fetchRecentHistory: [],
    callGemini: [],
    logBillableCall: [],
    logEvents: [],
  }

  const deps: GenerateQuickWorkoutDeps = {
    async getUser(authHeader: string) {
      calls.getUser.push({ authHeader })
      return overrides.getUser ? overrides.getUser(authHeader) : { ...USER }
    },
    async checkQuota(userId: string, email: string | null) {
      calls.checkQuota.push({ userId, email })
      return overrides.checkQuota ? overrides.checkQuota(userId, email) : { allowed: true }
    },
    async fetchCatalog(equipmentValues: string[], muscleGroupFilter?: string[]) {
      calls.fetchCatalog.push({ equipmentValues, muscleGroupFilter })
      return overrides.fetchCatalog
        ? overrides.fetchCatalog(equipmentValues, muscleGroupFilter)
        : CATALOG
    },
    async fetchProfile(userId: string) {
      calls.fetchProfile.push({ userId })
      return PROFILE
    },
    async fetchRecentHistory(userId: string) {
      calls.fetchRecentHistory.push({ userId })
      return HISTORY
    },
    async callGemini(prompt: string) {
      calls.callGemini.push({ prompt })
      return overrides.callGemini
        ? overrides.callGemini(prompt)
        : {
            exerciseIds: ["ex-bench", "ex-row", "ex-curl", "ex-press", "ex-squat"],
            rationale: "Balanced upper body push/pull with one leg compound.",
          }
    },
    async logBillableCall(userId: string) {
      calls.logBillableCall.push({ userId })
      if (overrides.logBillableCall) await overrides.logBillableCall(userId)
    },
    log(event: LogEvent) {
      calls.logEvents.push(event)
    },
  }

  return { deps, calls }
}

function makeRequest(body: Record<string, unknown>, opts: { authHeader?: string } = {}): Request {
  return new Request("http://test/generate", {
    method: "POST",
    headers: {
      Authorization: opts.authHeader ?? "Bearer test-token",
      "Content-Type": "application/json",
      "x-request-id": "req-1",
    },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  duration: 30,
  equipmentCategories: ["full-gym"],
  muscleGroups: ["full-body"],
  locale: "en",
}

// ---------------------------------------------------------------------------
// Tests — one per ticket-mandated behavior
// ---------------------------------------------------------------------------

Deno.test("happy path returns exerciseIds + rationale and writes exactly one quick_workout billable row", async () => {
  const { deps, calls } = makeDeps()
  const res = await handleGenerateQuickWorkout(makeRequest(VALID_BODY), deps)

  assertEquals(res.status, 200)
  const body = (await res.json()) as { exerciseIds: string[]; rationale: string }
  assertEquals(body.exerciseIds.length > 0, true)
  assertEquals(typeof body.rationale, "string")

  // Order of operations: quota → fetches → gemini → log billable. The
  // billable row MUST be written exactly once on the success path.
  assertEquals(calls.checkQuota.length, 1)
  assertEquals(calls.callGemini.length, 1)
  assertEquals(calls.logBillableCall.length, 1)
  assertEquals(calls.logBillableCall[0].userId, "user-1")
})

Deno.test("returns 401 with auth_missing when getUser yields null — short-circuits before quota / model", async () => {
  const { deps, calls } = makeDeps({ getUser: async () => null })
  const res = await handleGenerateQuickWorkout(makeRequest(VALID_BODY, { authHeader: "" }), deps)

  assertEquals(res.status, 401)
  assertEquals(((await res.json()) as { error: string }).error, "auth_missing")
  assertEquals(calls.checkQuota.length, 0, "must not check quota for unauthenticated calls")
  assertEquals(calls.callGemini.length, 0)
  assertEquals(calls.logBillableCall.length, 0)
})

Deno.test("quota gate fires BEFORE the Gemini call (zero free retries when capped)", async () => {
  const { deps, calls } = makeDeps({
    checkQuota: async () => ({ allowed: false }),
  })
  const res = await handleGenerateQuickWorkout(makeRequest(VALID_BODY), deps)

  assertEquals(res.status, 429)
  assertEquals(((await res.json()) as { error: string }).error, "quota_exceeded")

  // The cap is meaningless if the model still spins up — assert the
  // ordering. Also no billable row on a denied request: the user spent
  // zero tokens.
  assertEquals(calls.callGemini.length, 0, "quota denial must short-circuit before Gemini")
  assertEquals(calls.fetchCatalog.length, 0, "no need to read the catalog if we're not generating")
  assertEquals(calls.logBillableCall.length, 0)
})

Deno.test("log_everything: logBillableCall runs even when callGemini throws (non-bypassable cap)", async () => {
  const modelErr = new Error("upstream 500 from gemini")
  const { deps, calls } = makeDeps({
    callGemini: async () => {
      throw modelErr
    },
  })

  const res = await handleGenerateQuickWorkout(makeRequest(VALID_BODY), deps)

  // 502 surfaces "we hit the model and it failed" — distinct from 429
  // (quota) and 504 (our own timeout). Body uses the canonical kind so
  // the PWA can map to the right toast.
  assertEquals(res.status, 502)
  assertEquals(((await res.json()) as { error: string }).error, "model_failure")

  // The whole point of T126's quota source: a Gemini failure must still
  // credit the cap or users can grind their way past it by triggering
  // provider errors. CONTEXT.md `Embedded Agent quota` calls this
  // log_everything; we ported the rule to quick_workout in T127.
  assertEquals(
    calls.logBillableCall.length,
    1,
    "model failure MUST still credit the quick_workout quota (log_everything)",
  )
  assertEquals(calls.logBillableCall[0].userId, "user-1")
})

Deno.test("structured log emitted on provider failure with the canonical envelope", async () => {
  const { deps, calls } = makeDeps({
    callGemini: async () => {
      throw new Error("boom")
    },
  })

  await handleGenerateQuickWorkout(makeRequest(VALID_BODY), deps)

  const errors = calls.logEvents.filter((e) => e.level === "error")
  assertEquals(errors.length, 1, "exactly one structured error log on provider failure")
  assertEquals(errors[0].feature, "generate-quick-workout")
  assertEquals(errors[0].route, "/generate")
  assertEquals(errors[0].error_kind, "model_failure")
  assertEquals(errors[0].user_id, "user-1")
  assertEquals(errors[0].request_id, "req-1", "request_id propagates from x-request-id header")
})

Deno.test("equipment allowlist rejects values outside {bodyweight, dumbbells, full-gym}", async () => {
  const { deps, calls } = makeDeps()
  const res = await handleGenerateQuickWorkout(
    makeRequest({ ...VALID_BODY, equipmentCategories: ["machine"] }),
    deps,
  )

  assertEquals(res.status, 400)
  assertEquals(((await res.json()) as { error: string }).error, "Invalid equipmentCategories")
  // Reject pre-quota — saves a roundtrip and keeps the cap clean for
  // legitimate calls.
  assertEquals(calls.checkQuota.length, 0)
  assertEquals(calls.callGemini.length, 0)
})

Deno.test("equipment allowlist rejects mixing full-gym with another category", async () => {
  // `full-gym` is mutually exclusive with the per-equipment buckets; mixing
  // would either return a partial union (wrong) or duplicate entries (also
  // wrong). Legacy behavior preserved byte-for-byte.
  const { deps } = makeDeps()
  const res = await handleGenerateQuickWorkout(
    makeRequest({ ...VALID_BODY, equipmentCategories: ["full-gym", "bodyweight"] }),
    deps,
  )
  assertEquals(res.status, 400)
})

Deno.test("muscle group filter scopes the catalog query when the user picks specific groups (not full-body)", async () => {
  const { deps, calls } = makeDeps()
  await handleGenerateQuickWorkout(
    makeRequest({ ...VALID_BODY, muscleGroups: ["Pectoraux", "Dos"] }),
    deps,
  )
  assertEquals(calls.fetchCatalog.length, 1)
  assertEquals(calls.fetchCatalog[0].muscleGroupFilter, ["Pectoraux", "Dos"])
})

Deno.test("full-body skips the muscle group filter (catalog is the full equipment-scoped pool)", async () => {
  const { deps, calls } = makeDeps()
  await handleGenerateQuickWorkout(makeRequest(VALID_BODY), deps)
  assertEquals(calls.fetchCatalog[0].muscleGroupFilter, undefined)
})

Deno.test("empty catalog (no exercises match the filters) returns 404 without billing the user", async () => {
  const { deps, calls } = makeDeps({
    fetchCatalog: async () => [],
  })
  const res = await handleGenerateQuickWorkout(makeRequest(VALID_BODY), deps)
  assertEquals(res.status, 404)
  assertEquals(calls.callGemini.length, 0)
  assertEquals(calls.logBillableCall.length, 0)
})
