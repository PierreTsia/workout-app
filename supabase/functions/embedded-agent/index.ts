import { corsHeaders } from "../_shared/cors.ts"
import { createServiceClient, createUserClient } from "../_shared/supabase.ts"
import {
  appendMessage,
  bumpDraftCount24h,
  getActiveThread,
  getOrCreateActiveThread,
  markStaleIfDue,
  purgeDueForUser,
  resetForReject,
  setLastPreview,
  setStatus,
  type SupabaseLike,
  type Thread,
  type ThreadLocale,
} from "./threadStore.ts"
import {
  enforceDraftQuota,
  enforceTurnQuota,
  logBillableCall,
  type QuotaSupabaseLike,
} from "./quota.ts"
import { callChatGemini } from "./chatModel.ts"
import type { UserContextProfile } from "./prompt.ts"
import {
  runProgramDraftStep,
  type DraftArgs,
  type DraftDeps,
  type DraftResult,
  type LastPreview,
} from "./draft.ts"
import type {
  CatalogExercise,
  RecentExercise,
  UserProfile as ProgramUserProfile,
} from "../generate-program/prompt.ts"
import { callGeminiProgram } from "../generate-program/gemini.ts"
import { checkQuota, decodeJwt } from "../_shared/aiQuota.ts"
import { callMcpTool } from "../_shared/mcpClient.ts"
import { handleEmbeddedAgent } from "./handler.ts"
import { emitLog } from "./log.ts"

/**
 * Embedded Agent edge function (T117 + T118 + T119 + T120). Single POST
 * endpoint multiplexed on `body.action`:
 *
 *   - `{ action: "open", locale: "en" | "fr" }` — resume or create the user's
 *     active onboarding thread. Lazy 7d staleness sweep on resume.
 *   - `{ action: "abandon" }` — mark the user's active thread abandoned.
 *     Idempotent when there is none.
 *   - `{ action: "send", content, locale }` — append the user message,
 *     enforce the 40 turns/h quota, call the model, log the billable call
 *     (success or failure: log_everything), append the assistant message,
 *     return `{ assistant: { content, ts }, ready_for_draft }`.
 *   - `{ action: "draft", trigger, locale }` — run the program draft step
 *     (catalog + chat transcript → Gemini → validate → MCP `create_program`
 *     dry_run), persist `last_preview`, flip status to `preview_ready`.
 *   - `{ action: "reject" }` — reject the stashed preview, flip back to
 *     `open`, clear `last_preview`. Idempotent.
 *   - `{ action: "commit", confirm: true }` — close the commit gate. Calls
 *     MCP `create_program` with `dry_run: false`, transitions thread to
 *     `committed`, purges raw messages, returns `{ program_id }`.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  // The narrow `SupabaseLike` / `QuotaSupabaseLike` interfaces mirror the
  // chain shape we actually use; the real client returns wider types per
  // call. We cast at the boundary so unit tests stay decoupled from
  // supabase-js.
  //
  // Thread + profile reads/writes go through the user-scoped client (RLS
  // restricts them to the authenticated user). Quota counting + billable
  // logging go through the service client (`ai_generation_log` has RLS
  // enabled with no policies, so user-scoped writes are denied — same
  // pattern as `_shared/aiQuota.ts`). The userId we feed quota helpers
  // comes from the verified `getUser()` JWT, so service-role can't be
  // abused to log against another user.
  const userClient = createUserClient(authHeader)
  const serviceClient = createServiceClient()
  const threadDb = userClient as unknown as SupabaseLike
  const quotaDb = serviceClient as unknown as QuotaSupabaseLike

  // Email is needed for the existing `checkQuota` whitelist lookup. We
  // peel it off the JWT once at the boundary; quota helpers stay purely
  // userId-driven so tests don't need JWT plumbing.
  const tokenPart = authHeader.replace("Bearer ", "")
  const userEmail = decodeJwt(tokenPart)?.email?.toLowerCase() ?? null

  const draftDeps: DraftDeps = {
    fetchCatalog: (equipmentValues) => fetchCatalog(serviceClient, equipmentValues),
    fetchProfile: (userId) => fetchProgramProfile(serviceClient, userId),
    fetchRecentHistory: (userId) => fetchRecentHistory(serviceClient, userId),
    callModel: callGeminiProgram,
  }

  const res = await handleEmbeddedAgent(req, {
    getUser: async (header) => {
      if (!header) return null
      const { data, error } = await userClient.auth.getUser()
      if (error || !data.user?.id) return null
      return { userId: data.user.id }
    },
    getActiveThread: (userId) => getActiveThread(threadDb, userId),
    getOrCreateActiveThread: (userId, locale: ThreadLocale) =>
      getOrCreateActiveThread(threadDb, userId, locale),
    markStaleIfDue: (thread: Thread) => markStaleIfDue(threadDb, thread),
    setStatusToAbandoned: (thread: Thread) => setStatus(threadDb, thread, "abandoned"),
    appendMessage: async (thread, role, content) => {
      await appendMessage(threadDb, thread, role, content)
      const { data, error } = await userClient
        .from("embedded_agent_threads")
        .select("*")
        .eq("id", thread.id)
        .single()
      if (error || !data) {
        throw new Error(`appendMessage reload failed: ${error?.message ?? "no row"}`)
      }
      return data as Thread
    },
    enforceTurnQuota: (userId) => enforceTurnQuota(quotaDb, userId),
    enforceDraftQuota: (userId) => enforceDraftQuota(quotaDb, userId),
    enforceProgramQuota: (userId) => checkQuota(serviceClient, userId, userEmail, "program"),
    logBillableCall: (userId, source) => logBillableCall(quotaDb, userId, source),
    chatModel: callChatGemini,
    loadProfile: (userId) => loadProfile(userClient, userId),
    runDraftStep: (input): Promise<DraftResult> =>
      runProgramDraftStep(
        { userId: input.userId, locale: input.locale, thread: input.thread, profile: input.profile },
        draftDeps,
      ),
    callMcp: (args: DraftArgs & { dry_run: boolean }) =>
      callMcpTool({
        mcpUrl: resolveMcpUrl(),
        userAccessToken: tokenPart,
        toolName: "create_program",
        arguments: args as unknown as Record<string, unknown>,
      }),
    setLastPreview: (thread: Thread, preview: LastPreview) =>
      setLastPreview(threadDb, thread, preview as unknown as Record<string, unknown>),
    setStatusToPreviewReady: (thread: Thread) => setStatus(threadDb, thread, "preview_ready"),
    bumpDraftCount24h: (thread: Thread) => bumpDraftCount24h(threadDb, thread),
    resetForReject: (thread: Thread) => resetForReject(threadDb, thread),
    setStatusToCommitted: (
      thread: Thread,
      patch: { program_id: string; summary?: string },
    ) => setStatus(threadDb, thread, "committed", patch),
    purgeRetention: (userId: string) => purgeDueForUser(threadDb, userId),
    log: emitLog,
  })

  const merged = new Headers(res.headers)
  for (const [k, v] of Object.entries(corsHeaders)) merged.set(k, v)
  return new Response(res.body, { status: res.status, headers: merged })
})

async function loadProfile(
  supabase: ReturnType<typeof createUserClient>,
  userId: string,
): Promise<UserContextProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "goal, experience, equipment, training_days_per_week, session_duration_minutes, age, weight_kg, gender",
    )
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !data) return null
  return data as UserContextProfile
}

// ---------- generate-program parity helpers ----------
//
// These mirror the equivalents in `supabase/functions/generate-program/index.ts`.
// We don't import them because that file uses `Deno.serve` at the top
// level, which would double-register a handler if we pulled the module
// in. Worth extracting to `_shared/programCatalog.ts` as a follow-up.

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

async function fetchProgramProfile(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<ProgramUserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("experience, goal, equipment, training_days_per_week, age, gender")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data as ProgramUserProfile | null
}

async function fetchRecentHistory(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<{ exercises: RecentExercise[]; lastSessionAt: string | null }> {
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

function resolveMcpUrl(): string {
  const explicit = Deno.env.get("MCP_URL")
  if (explicit) return explicit
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  if (!supabaseUrl) {
    throw new Error("MCP_URL or SUPABASE_URL must be set")
  }
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/mcp`
}

