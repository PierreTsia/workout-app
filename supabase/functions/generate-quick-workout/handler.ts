// Pure handler for the generate-quick-workout Edge function (T127, #342).
// Replaces the inline `Deno.serve` body of the soon-to-die `generate-workout/`
// function. Logic deltas vs. the legacy path:
//   1. quota source flips from `'workout'` → `'quick_workout'` (T126)
//   2. every Gemini call is wrapped in `callGeminiWithBilling`, which
//      always credits the cap in `finally` — log_everything per call,
//      not per request, so a future second model call can't silently
//      undercount (PR #347 review C4). Today there's only one call:
//      `validateAndRepair`'s backfill produces a usable workout even
//      when the LLM returns 100% garbage, so the "retry on empty
//      result" branch the legacy code carried was unreachable.
//
// The deps interface keeps the handler sink-agnostic: tests inject fakes
// for auth / quota / fetches / model / log; `index.ts` wires the real
// implementations.

import { corsHeaders } from "../_shared/cors.ts"
import { parseFocusAreasField } from "../_shared/aiFocusAreas.ts"
import {
  buildPrompt,
  capCatalog,
  getEquipmentValuesForCategories,
  getTargetExerciseCount,
} from "./prompt.ts"
import { validateAndRepair, type QwDayItem } from "./validate.ts"
import { ProviderError } from "../_shared/providerError.ts"
import type {
  CatalogExercise,
  UserProfile,
  RecentExercise,
} from "../_shared/programCatalog.ts"
import type { LogEvent } from "./log.ts"

export type { LogEvent } from "./log.ts"

const ALLOWED_EQUIPMENT_CATEGORIES = new Set(["bodyweight", "dumbbells", "full-gym"])

export interface GenerateQuickWorkoutDeps {
  /** Returns `null` to signal an unauthenticated / malformed-token request. */
  getUser: (authHeader: string) => Promise<{ userId: string; email: string | null } | null>
  checkQuota: (userId: string, email: string | null) => Promise<{ allowed: boolean }>
  fetchCatalog: (
    equipmentValues: string[],
    muscleGroupFilter?: string[],
  ) => Promise<CatalogExercise[]>
  fetchProfile: (userId: string) => Promise<UserProfile | null>
  fetchRecentHistory: (
    userId: string,
  ) => Promise<{ exercises: RecentExercise[]; lastSessionAt: string | null }>
  callGemini: (
    prompt: string,
  ) => Promise<{
    exerciseIds: string[]
    exercises?: QwDayItem[]
    rationale: string
  }>
  /** Inserts one `ai_generation_log` row tagged `quick_workout` (log_everything). */
  logBillableCall: (userId: string) => Promise<void>
  log: (event: LogEvent) => void
}

interface ParsedRequest {
  duration: number
  muscleGroups: string[]
  equipmentCategories: string[]
  focusAreas?: string
  locale: "en" | "fr"
}

function parseEquipmentCategories(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const cats = raw.map(String)
  if (cats.some((c) => !ALLOWED_EQUIPMENT_CATEGORIES.has(c))) return null
  // `full-gym` is mutually exclusive with the per-equipment buckets so
  // the catalog query returns the broad set instead of a partial union.
  if (cats.includes("full-gym") && cats.length !== 1) return null
  return cats
}

function parseLocale(raw: unknown): "en" | "fr" {
  if (raw == null || raw === "") return "en"
  return String(raw).trim().toLowerCase().startsWith("fr") ? "fr" : "en"
}

function parseRequest(body: Record<string, unknown>): ParsedRequest | { error: string } {
  const focus = parseFocusAreasField(body)
  if (focus.error) return { error: focus.error }

  const { duration, muscleGroups, equipmentCategories } = body
  if (
    duration === undefined ||
    duration === null ||
    muscleGroups === undefined ||
    equipmentCategories === undefined
  ) {
    return {
      error: "Missing required fields: duration, equipmentCategories, muscleGroups",
    }
  }
  if (!Array.isArray(muscleGroups)) return { error: "Invalid muscleGroups" }
  const cats = parseEquipmentCategories(equipmentCategories)
  if (!cats) return { error: "Invalid equipmentCategories" }

  return {
    duration: Number(duration),
    muscleGroups: muscleGroups.map(String),
    equipmentCategories: cats,
    focusAreas: focus.focusAreas,
    locale: parseLocale(body.locale),
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

/**
 * Wraps a Gemini call so the cap is credited *per call* — success or
 * failure — in `finally`. Centralizing the rule here means any future
 * second model invocation automatically pays its way; a previous
 * version of this handler called `logBillableCall` only on the success
 * path and would have undercounted any retry leg (PR #347, C4).
 *
 * Cap-write failures are logged but never thrown: a Postgres blip
 * shouldn't turn a working generation into a 5xx. The same pragmatic
 * trade-off the legacy generate-workout function made.
 */
async function callGeminiWithBilling(
  prompt: string,
  deps: Pick<GenerateQuickWorkoutDeps, "callGemini" | "logBillableCall" | "log">,
  ctx: { userId: string; requestId: string },
): Promise<{ exerciseIds: string[]; rationale: string }> {
  try {
    return await deps.callGemini(prompt)
  } finally {
    await deps.logBillableCall(ctx.userId).catch((logErr) => {
      deps.log({
        level: "warn",
        feature: "generate-quick-workout",
        route: "/generate",
        error_kind: "log_billable_call_failed",
        request_id: ctx.requestId,
        user_id: ctx.userId,
        message: logErr instanceof Error ? logErr.message : String(logErr),
      })
    })
  }
}

export async function handleGenerateQuickWorkout(
  req: Request,
  deps: GenerateQuickWorkoutDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()

  // ---- 1. Auth ----
  const authHeader = req.headers.get("Authorization") ?? ""
  const user = await deps.getUser(authHeader)
  if (!user) return jsonResponse({ error: "auth_missing" }, 401)
  const { userId, email } = user

  // ---- 2. Parse + validate body ----
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const parsed = parseRequest(body)
  if ("error" in parsed) return jsonResponse({ error: parsed.error }, 400)

  // ---- 3. Quota gate (BEFORE the catalog fetch + model call) ----
  const quota = await deps.checkQuota(userId, email)
  if (!quota.allowed) return jsonResponse({ error: "quota_exceeded" }, 429)

  // ---- 4. Catalog / profile / history (parallel) ----
  const equipmentValues = getEquipmentValuesForCategories(parsed.equipmentCategories)
  const isFullBody =
    parsed.muscleGroups.length === 0 || parsed.muscleGroups.includes("full-body")
  const muscleGroupFilter = isFullBody ? undefined : parsed.muscleGroups

  const [catalogRaw, profile, history] = await Promise.all([
    deps.fetchCatalog(equipmentValues, muscleGroupFilter),
    deps.fetchProfile(userId),
    deps.fetchRecentHistory(userId),
  ])

  const catalog = capCatalog(catalogRaw)
  if (catalog.length === 0) {
    return jsonResponse({ error: "No exercises match the given filters" }, 404)
  }

  // ---- 5. Build prompt + call Gemini (log_everything in finally) ----
  const targetCount = getTargetExerciseCount(parsed.duration)
  const prompt = buildPrompt(
    catalog,
    profile,
    history.exercises,
    {
      duration: parsed.duration,
      equipmentCategories: parsed.equipmentCategories,
      muscleGroups: parsed.muscleGroups,
      focusAreas: parsed.focusAreas,
      locale: parsed.locale,
    },
  )

  let llmOutput: { exerciseIds: string[]; exercises?: QwDayItem[]; rationale: string }
  try {
    llmOutput = await callGeminiWithBilling(prompt, deps, { userId, requestId })
  } catch (err) {
    deps.log({
      level: "error",
      feature: "generate-quick-workout",
      route: "/generate",
      error_kind: "model_failure",
      request_id: requestId,
      user_id: userId,
      message: err instanceof Error ? err.message : String(err),
    })
    // A Gemini abort propagates as a raw AbortError (message contains
    // "abort"); a Groq abort is wrapped as `ProviderError(kind: "timeout")`
    // (#405) whose message has no "abort". Check the typed kind first so a
    // fallback-provider timeout still maps to 504, not a generic 502.
    const isTimeout =
      (err instanceof ProviderError && err.kind === "timeout") ||
      (err instanceof Error && err.message.includes("abort"))
    return jsonResponse(
      { error: isTimeout ? "timeout" : "model_failure" },
      isTimeout ? 504 : 502,
    )
  }

  // ---- 6. Validate and repair ----
  // No retry leg: `validateAndRepair`'s backfill yields a usable list as
  // long as `catalog.length > 0` (gated above), so the legacy "empty →
  // re-prompt" branch was dead code that just confused the billing
  // story. If we ever need a real retry, route it through
  // `callGeminiWithBilling` so the cap stays in sync.
  const catalogIds = catalog.map((e) => ({ id: e.id, muscle_group: e.muscle_group }))
  // Prefer mixed `exercises` day-items when the model emits Circuits (T170);
  // fall back to legacy flat `exerciseIds`.
  const llmItems =
    Array.isArray(llmOutput.exercises) && llmOutput.exercises.length > 0
      ? llmOutput.exercises
      : llmOutput.exerciseIds
  const result = validateAndRepair(llmItems, catalogIds, targetCount)

  return jsonResponse({
    items: result.items,
    exerciseIds: result.exerciseIds,
    repaired: result.repaired,
    rationale: llmOutput.rationale.trim(),
  })
}
