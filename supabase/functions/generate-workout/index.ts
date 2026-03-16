import { corsHeaders } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { callGemini } from "./gemini.ts"
import {
  buildPrompt,
  capCatalog,
  getEquipmentValues,
  getTargetExerciseCount,
  type CatalogExercise,
  type UserProfile,
  type RecentExercise,
} from "./prompt.ts"
import { validateAndRepair } from "./validate.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createServiceClient()

    // --- Two-layer auth: extract and verify JWT ---
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing authorization header" }, 401)
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return jsonResponse({ error: "Invalid or expired token" }, 401)
    }

    // --- Parse request body ---
    const body = await req.json()
    const { duration, equipmentCategory, muscleGroups } = body

    if (!duration || !equipmentCategory || !muscleGroups) {
      return jsonResponse(
        {
          error:
            "Missing required fields: duration, equipmentCategory, muscleGroups",
        },
        400,
      )
    }

    const equipmentValues = getEquipmentValues(equipmentCategory)
    const targetCount = getTargetExerciseCount(duration)
    const isFullBody =
      muscleGroups.length === 0 || muscleGroups.includes("full-body")

    // --- 3 parallel DB queries ---
    const [catalogResult, profileResult, historyResult] = await Promise.all([
      fetchCatalog(supabase, equipmentValues, muscleGroups, isFullBody),
      fetchProfile(supabase, user.id),
      fetchRecentHistory(supabase, user.id),
    ])

    const catalog = capCatalog(catalogResult)

    if (catalog.length === 0) {
      return jsonResponse({ error: "No exercises match the given filters" }, 404)
    }

    // --- Build prompt and call Gemini ---
    const prompt = buildPrompt(catalog, profileResult, historyResult, {
      duration,
      equipmentCategory,
      muscleGroups,
    })

    let llmOutput = await callGemini(prompt)

    // --- Validate and repair ---
    let result = validateAndRepair(
      llmOutput,
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
        "\n\nPREVIOUS ATTEMPT FAILED: all returned IDs were invalid. " +
        "Please return ONLY IDs from the EXERCISE CATALOG above."

      llmOutput = await callGemini(retryPrompt)
      result = validateAndRepair(
        llmOutput,
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

    return jsonResponse({
      exerciseIds: result.exerciseIds,
      repaired: result.repaired,
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
    .select("experience, goal, equipment, training_days_per_week")
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
