import { corsHeaders } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { callGeminiProgram } from "./gemini.ts"
import {
  buildProgramPrompt,
  capCatalog,
  getEquipmentValues,
  getExerciseBounds,
  type CatalogExercise,
  type UserProfile,
  type RecentExercise,
  type ProgramConstraints,
} from "./prompt.ts"
import { validateProgram } from "./validate.ts"

const TRAINING_GAP_DAYS = 14
const QUOTA_WHITELISTED = 5
const QUOTA_REGULAR = 5
const WINDOW_WHITELISTED_MS = 24 * 60 * 60 * 1000
const WINDOW_REGULAR_MS = 30 * 24 * 60 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
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
    const email = jwt.email ?? null
    const supabase = createServiceClient()

    // --- Quota check ---
    const quotaResult = await checkQuota(supabase, userId, email)
    if (!quotaResult.allowed) {
      return jsonResponse({ error: "quota_exceeded" }, 429)
    }

    const body = await req.json()
    const constraints = parseConstraints(body)
    if (!constraints) {
      return jsonResponse(
        { error: "Missing required fields: daysPerWeek, duration, equipmentCategory, goal, experience" },
        400,
      )
    }

    const equipmentValues = getEquipmentValues(constraints.equipmentCategory)
    const exerciseBounds = getExerciseBounds(constraints.duration)

    const [catalogResult, profileResult, historyResult] = await Promise.all([
      fetchCatalog(supabase, equipmentValues),
      fetchProfile(supabase, userId),
      fetchRecentHistory(supabase, userId),
    ])

    const catalog = capCatalog(catalogResult)
    if (catalog.length === 0) {
      return jsonResponse({ error: "No exercises match the given filters" }, 404)
    }

    const trainingGap = computeTrainingGap(historyResult.lastSessionAt)

    const prompt = buildProgramPrompt(
      catalog,
      profileResult,
      historyResult.exercises,
      constraints,
      trainingGap,
    )

    let llmOutput = await callGeminiProgram(prompt)
    let result = validateProgram(
      llmOutput,
      catalog.map((e) => ({ id: e.id, muscle_group: e.muscle_group })),
      constraints.daysPerWeek,
      exerciseBounds,
    )

    if (result.days.length === 0 || result.days.every((d) => d.exercise_ids.length === 0)) {
      const retryPrompt =
        prompt +
        "\n\nPREVIOUS ATTEMPT FAILED: all returned exercise IDs were invalid. " +
        "Please return ONLY IDs from the EXERCISE CATALOG above."

      llmOutput = await callGeminiProgram(retryPrompt)
      result = validateProgram(
        llmOutput,
        catalog.map((e) => ({ id: e.id, muscle_group: e.muscle_group })),
        constraints.daysPerWeek,
        exerciseBounds,
      )

      if (result.days.length === 0 || result.days.every((d) => d.exercise_ids.length === 0)) {
        return jsonResponse(
          { error: "AI generation failed after retry — no valid program returned" },
          422,
        )
      }
    }

    // Log successful generation for quota tracking (fire-and-forget)
    supabase.from("ai_generation_log").insert({ user_id: userId }).then()

    return jsonResponse({
      rationale: result.rationale,
      days: result.days.map((d) => ({
        label: d.label,
        muscle_focus: d.muscle_focus,
        exercise_ids: d.exercise_ids,
      })),
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

interface JwtPayload {
  sub: string
  email?: string
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    if (typeof payload.sub !== "string") return null
    return { sub: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

async function checkQuota(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  email: string | null,
): Promise<{ allowed: boolean }> {
  const [whitelistResult, countResult] = await Promise.all([
    email
      ? supabase
          .from("ai_whitelisted_users")
          .select("email")
          .eq("email", email)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("ai_generation_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - WINDOW_REGULAR_MS).toISOString()),
  ])

  const isWhitelisted = !!whitelistResult.data
  const totalCount = countResult.count ?? 0

  if (isWhitelisted) {
    const { count: recentCount } = await supabase
      .from("ai_generation_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - WINDOW_WHITELISTED_MS).toISOString())

    return { allowed: (recentCount ?? 0) < QUOTA_WHITELISTED }
  }

  return { allowed: totalCount < QUOTA_REGULAR }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function parseConstraints(body: Record<string, unknown>): ProgramConstraints | null {
  const { daysPerWeek, duration, equipmentCategory, goal, experience } = body
  if (!daysPerWeek || !duration || !equipmentCategory || !goal || !experience) return null

  return {
    daysPerWeek: Number(daysPerWeek),
    duration: Number(duration),
    equipmentCategory: String(equipmentCategory),
    goal: String(goal),
    experience: String(experience),
    focusAreas: body.focusAreas ? String(body.focusAreas) : undefined,
    splitPreference: body.splitPreference ? String(body.splitPreference) : undefined,
  }
}

function computeTrainingGap(lastSessionAt: string | null): boolean {
  if (!lastSessionAt) return true
  const daysAgo = (Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60 * 24)
  return daysAgo > TRAINING_GAP_DAYS
}

async function fetchCatalog(
  supabase: ReturnType<typeof createServiceClient>,
  equipmentValues: string[],
): Promise<CatalogExercise[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name_en, muscle_group, equipment, secondary_muscles, difficulty_level")
    .in("equipment", equipmentValues)
    .order("muscle_group")
    .order("name")

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

interface HistoryResult {
  exercises: RecentExercise[]
  lastSessionAt: string | null
}

async function fetchRecentHistory(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<HistoryResult> {
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, finished_at")
    .eq("user_id", userId)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(5)

  if (sessionsError) throw sessionsError
  if (!sessions || sessions.length === 0) return { exercises: [], lastSessionAt: null }

  const lastSessionAt = (sessions[0] as { finished_at: string }).finished_at
  const sessionIds = sessions.map((s: { id: string }) => s.id)

  const { data: logs, error: logsError } = await supabase
    .from("set_logs")
    .select("exercise_id, exercise_name_snapshot")
    .in("session_id", sessionIds)

  if (logsError) throw logsError
  if (!logs) return { exercises: [], lastSessionAt }

  const seen = new Set<string>()
  const unique: RecentExercise[] = []
  for (const log of logs as RecentExercise[]) {
    if (!seen.has(log.exercise_id)) {
      seen.add(log.exercise_id)
      unique.push(log)
    }
  }

  return { exercises: unique, lastSessionAt }
}
