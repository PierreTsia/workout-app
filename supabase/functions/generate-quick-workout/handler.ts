// Pure handler for the generate-quick-workout Edge function (T127, #342).
// Replaces the inline `Deno.serve` body of the soon-to-die `generate-workout/`
// function. Logic is byte-equivalent to the legacy path with two delta:
//   1. quota source flips from `'workout'` → `'quick_workout'` (T126)
//   2. `logBillableCall` runs in `finally` (log_everything), not only on
//      success — closes the quota-bypass gap where a Gemini failure
//      previously gave the user a free retry.
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
import { validateAndRepair } from "./validate.ts"
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
  callGemini: (prompt: string) => Promise<{ exerciseIds: string[]; rationale: string }>
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

  let llmOutput: { exerciseIds: string[]; rationale: string }
  try {
    llmOutput = await deps.callGemini(prompt)
  } catch (err) {
    // log_everything: quota row persists even on model failure so retry
    // budgets aren't bypassed by triggering provider errors.
    await deps.logBillableCall(userId).catch((logErr) => {
      deps.log({
        level: "warn",
        feature: "generate-quick-workout",
        route: "/generate",
        error_kind: "log_billable_call_failed",
        request_id: requestId,
        user_id: userId,
        message: logErr instanceof Error ? logErr.message : String(logErr),
      })
    })
    deps.log({
      level: "error",
      feature: "generate-quick-workout",
      route: "/generate",
      error_kind: "model_failure",
      request_id: requestId,
      user_id: userId,
      message: err instanceof Error ? err.message : String(err),
    })
    const isTimeout = err instanceof Error && err.message.includes("abort")
    return jsonResponse(
      { error: isTimeout ? "timeout" : "model_failure" },
      isTimeout ? 504 : 502,
    )
  }

  // ---- 6. Validate and repair (with one retry on catastrophic failure) ----
  const catalogIds = catalog.map((e) => ({ id: e.id, muscle_group: e.muscle_group }))
  let result = validateAndRepair(llmOutput.exerciseIds, catalogIds, targetCount)
  let rationale = llmOutput.rationale.trim()

  if (result.exerciseIds.length === 0) {
    const retryPrompt =
      prompt +
      "\n\nPREVIOUS ATTEMPT FAILED: all returned exerciseIds were invalid. " +
      "Return a JSON object with exerciseIds (valid catalog IDs only) and rationale, as specified above."

    try {
      const retryOutput = await deps.callGemini(retryPrompt)
      rationale = retryOutput.rationale.trim()
      result = validateAndRepair(retryOutput.exerciseIds, catalogIds, targetCount)
    } catch (err) {
      await deps.logBillableCall(userId).catch(() => {})
      deps.log({
        level: "error",
        feature: "generate-quick-workout",
        route: "/generate",
        error_kind: "model_failure_retry",
        request_id: requestId,
        user_id: userId,
        message: err instanceof Error ? err.message : String(err),
      })
      return jsonResponse({ error: "model_failure" }, 502)
    }

    if (result.exerciseIds.length === 0) {
      await deps.logBillableCall(userId).catch(() => {})
      return jsonResponse(
        { error: "AI generation failed after retry — no valid exercises returned" },
        422,
      )
    }
  }

  // ---- 7. Success path: log + return ----
  await deps.logBillableCall(userId)

  return jsonResponse({
    exerciseIds: result.exerciseIds,
    repaired: result.repaired,
    rationale,
  })
}
