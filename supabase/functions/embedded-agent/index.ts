import { corsHeaders } from "../_shared/cors.ts"
import { createServiceClient, createUserClient } from "../_shared/supabase.ts"
import {
  appendMessage,
  bumpDraftCount24h,
  consumePendingOverrides as consumePendingOverridesOnThread,
  getActiveThread,
  getOrCreateActiveThread,
  incrementValidatorRejection as incrementValidatorRejectionOnThread,
  markStaleIfDue,
  purgeDueForUser,
  resetForReject,
  setBundle as setBundleOnThread,
  setChangeMotivation as setChangeMotivationOnThread,
  setLastPreview,
  setPendingConstraintOverrides as setPendingConstraintOverridesOnThread,
  setStatus,
  type PendingConstraintOverrides,
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
import type { UserContextProfile } from "./prompt/index.ts"
import {
  runProgramDraftStep,
  type DraftArgs,
  type DraftDeps,
  type DraftResult,
  type LastPreview,
} from "./draft.ts"
import {
  fetchCatalog,
  fetchProfile as fetchProgramProfile,
  fetchRecentHistory,
} from "../_shared/programCatalog.ts"
import { callGeminiProgram } from "../_shared/programGemini.ts"
import { checkQuota, decodeJwt } from "../_shared/aiQuota.ts"
import { callMcpTool, resolveMcpUrl } from "../_shared/mcpClient.ts"
import { handleEmbeddedAgent } from "./handler.ts"
import { emitLog } from "./log.ts"
import { buildAdditionalProgramBundle } from "./lib/bundle.ts"
import {
  fetchActiveProgramForBundle,
  fetchProfileForBundle,
  fetchRecentStatsForBundle,
} from "./lib/bundleQueries.ts"

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
    getActiveThread: (userId, purpose) => getActiveThread(threadDb, userId, purpose),
    getOrCreateActiveThread: (userId, locale: ThreadLocale, purpose) =>
      getOrCreateActiveThread(threadDb, userId, locale, purpose),
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
    // T133 (#343) — additional-program bundle wiring. Queries go through
    // the service client so RLS doesn't filter out the `programs` rows
    // we need for the snapshot; the bundle is server-trusted and only
    // ever exposed to the LLM, never returned to the client raw.
    buildBundle: (userId: string) =>
      buildAdditionalProgramBundle(userId, {
        fetchProfile: (uid) => fetchProfileForBundle(serviceClient, uid),
        fetchActiveProgram: (uid) => fetchActiveProgramForBundle(serviceClient, uid),
        fetchRecentStats: (uid, windowDays) =>
          fetchRecentStatsForBundle(serviceClient, uid, windowDays),
      }),
    setBundle: (thread: Thread, bundle) =>
      setBundleOnThread(threadDb, thread, bundle as unknown as Record<string, unknown>),
    // T134 (#343) — additional-program /send + /draft + /reject persistence
    // hooks. All four are no-ops for onboarding (handler gates by purpose).
    incrementValidatorRejection: (thread: Thread) =>
      incrementValidatorRejectionOnThread(threadDb, thread),
    setChangeMotivation: (thread: Thread, motivation) =>
      setChangeMotivationOnThread(threadDb, thread, motivation),
    setPendingConstraintOverrides: (thread: Thread, overrides) =>
      setPendingConstraintOverridesOnThread(
        threadDb,
        thread,
        overrides as PendingConstraintOverrides | null,
      ),
    consumePendingOverrides: (thread: Thread) =>
      consumePendingOverridesOnThread(threadDb, thread),
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

// Catalog / profile / history readers live in `_shared/programCatalog.ts`
// (extracted in T126, #342). The aliasing import above keeps the local
// `fetchProgramProfile` name to avoid renaming every call site in this
// file.
