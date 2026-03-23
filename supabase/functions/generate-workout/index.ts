import { checkQuota, decodeJwt } from "../_shared/aiQuota.ts"
import { parseFocusAreasField } from "../_shared/aiFocusAreas.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { callGemini } from "./gemini.ts"
import {
  buildPrompt,
  capCatalog,
  getEquipmentValuesForCategories,
  getTargetExerciseCount,
  type CatalogExercise,
  type UserProfile,
  type RecentExercise,
} from "./prompt.ts"
import { validateAndRepair } from "./validate.ts"

const ALLOWED_EQUIPMENT_CATEGORIES = new Set([
  "bodyweight",
  "dumbbells",
  "full-gym",
])

function parseEquipmentCategories(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const cats: string[] = []
  for (const x of raw) {
    const c = String(x)
    if (!ALLOWED_EQUIPMENT_CATEGORIES.has(c)) return null
    cats.push(c)
  }
  if (cats.includes("full-gym") && cats.length !== 1) return null
  return cats
}

function parseWorkoutLocale(raw: unknown): "en" | "fr" {
  if (raw == null || raw === "") return "en"
  const s = String(raw).trim().toLowerCase()
  if (s.startsWith("fr")) return "fr"
  return "en"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // --- Auth: extract user ID from JWT ---
    // The gateway's verify_jwt already validated the signature.
    // We just decode the payload to get the user ID — no extra HTTP call.
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing authorization header" }, 401)
    }

    const token = authHeader.replace("Bearer ", "")
    const jwt = decodeJwt(token)
    if (!jwt?.sub) {
      return jsonResponse({ error: "Could not extract user from token" }, 401)
    }

    const userId = jwt.sub
    const email = jwt.email?.toLowerCase() ?? null
    const supabase = createServiceClient()

    const quotaResult = await checkQuota(supabase, userId, email, "workout")
    if (!quotaResult.allowed) {
      return jsonResponse({ error: "quota_exceeded" }, 429)
    }

    // --- Parse request body ---
    const body = (await req.json()) as Record<string, unknown>
    const focusParsed = parseFocusAreasField(body)
    if (focusParsed.error) {
      return jsonResponse({ error: focusParsed.error }, 400)
    }

    const { duration, muscleGroups, equipmentCategories } = body

    if (
      duration === undefined ||
      duration === null ||
      muscleGroups === undefined ||
      equipmentCategories === undefined
    ) {
      return jsonResponse(
        {
          error:
            "Missing required fields: duration, equipmentCategories, muscleGroups",
        },
        400,
      )
    }

    if (!Array.isArray(muscleGroups)) {
      return jsonResponse({ error: "Invalid muscleGroups" }, 400)
    }

    const parsedCategories = parseEquipmentCategories(equipmentCategories)
    if (!parsedCategories) {
      return jsonResponse({ error: "Invalid equipmentCategories" }, 400)
    }

    const locale = parseWorkoutLocale(body.locale)

    const equipmentValues = getEquipmentValuesForCategories(parsedCategories)
    const targetCount = getTargetExerciseCount(duration)
    const isFullBody =
      muscleGroups.length === 0 || muscleGroups.includes("full-body")

    // --- 3 parallel DB queries ---
    const [catalogResult, profileResult, historyResult] = await Promise.all([
      fetchCatalog(supabase, equipmentValues, muscleGroups, isFullBody),
      fetchProfile(supabase, userId),
      fetchRecentHistory(supabase, userId),
    ])

    const catalog = capCatalog(catalogResult)

    if (catalog.length === 0) {
      return jsonResponse({ error: "No exercises match the given filters" }, 404)
    }

    // --- Build prompt and call Gemini ---
    const prompt = buildPrompt(catalog, profileResult, historyResult, {
      duration: Number(duration),
      equipmentCategories: parsedCategories,
      muscleGroups: muscleGroups as string[],
      focusAreas: focusParsed.focusAreas,
      locale,
    })

    let llmOutput = await callGemini(prompt)
    let rationale = llmOutput.rationale.trim()

    // --- Validate and repair ---
    let result = validateAndRepair(
      llmOutput.exerciseIds,
      catalog.map((e) => ({
        id: e.id,
        muscle_group: e.muscle_group,
      })),
      targetCount,
    )

    // Retry once on catastrophic failure (zero valid exercises)
    if (result.exerciseIds.length === 0) {
      const retryPrompt =
        prompt +
        "\n\nPREVIOUS ATTEMPT FAILED: all returned exerciseIds were invalid. " +
        "Return a JSON object with exerciseIds (valid catalog IDs only) and rationale, as specified above."

      llmOutput = await callGemini(retryPrompt)
      rationale = llmOutput.rationale.trim()
      result = validateAndRepair(
        llmOutput.exerciseIds,
        catalog.map((e) => ({
          id: e.id,
          muscle_group: e.muscle_group,
        })),
        targetCount,
      )

      if (result.exerciseIds.length === 0) {
        return jsonResponse(
          { error: "AI generation failed after retry — no valid exercises returned" },
          422,
        )
      }
    }

    supabase.from("ai_generation_log").insert({ user_id: userId, source: "workout" }).then()

    return jsonResponse({
      exerciseIds: result.exerciseIds,
      repaired: result.repaired,
      rationale,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    const isTimeout = message.includes("abort")

    return jsonResponse(
      { error: isTimeout ? "timeout" : message },
      isTimeout ? 504 : 500,
    )
  }
})

// --- Helpers ---

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

async function fetchCatalog(
  supabase: ReturnType<typeof createServiceClient>,
  equipmentValues: string[],
  muscleGroups: string[],
  isFullBody: boolean,
): Promise<CatalogExercise[]> {
  let q = supabase
    .from("exercises")
    .select("id, name_en, muscle_group, equipment, secondary_muscles, difficulty_level")
    .in("equipment", equipmentValues)

  if (!isFullBody && muscleGroups.length > 0) {
    q = q.in("muscle_group", muscleGroups)
  }

  q = q.order("muscle_group").order("name")

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CatalogExercise[]
}

async function fetchProfile(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("experience, goal, equipment, training_days_per_week, age, gender")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  return data as UserProfile | null
}

async function fetchRecentHistory(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<RecentExercise[]> {
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(5)

  if (sessionsError) throw sessionsError
  if (!sessions || sessions.length === 0) return []

  const sessionIds = sessions.map((s: { id: string }) => s.id)

  const { data: logs, error: logsError } = await supabase
    .from("set_logs")
    .select("exercise_id, exercise_name_snapshot")
    .in("session_id", sessionIds)

  if (logsError) throw logsError
  if (!logs) return []

  const seen = new Set<string>()
  const unique: RecentExercise[] = []
  for (const log of logs as RecentExercise[]) {
    if (!seen.has(log.exercise_id)) {
      seen.add(log.exercise_id)
      unique.push(log)
    }
  }

  return unique
}
