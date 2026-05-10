// Production wiring for the generate-quick-workout Edge function (T127,
// #342). Thin shell — DI wiring + Deno.serve. All logic lives in
// `handler.ts` (test-friendly via `GenerateQuickWorkoutDeps`).

import { createServiceClient } from "../_shared/supabase.ts"
import { checkQuota, decodeJwt } from "../_shared/aiQuota.ts"
import {
  fetchCatalog,
  fetchProfile,
  fetchRecentHistory,
} from "../_shared/programCatalog.ts"
import { callGemini } from "./gemini.ts"
import { handleGenerateQuickWorkout } from "./handler.ts"
import { emitLog } from "./log.ts"

Deno.serve((req) => {
  // One service client per request — same pattern as embedded-agent. The
  // user identity is established by `getUser` below (JWT decode) so RLS
  // doesn't apply to the catalog reads, which is intentional: the catalog
  // is global, the only user-scoped reads are profile + history (filtered
  // by user_id in the SELECT).
  const serviceClient = createServiceClient()

  return handleGenerateQuickWorkout(req, {
    async getUser(authHeader) {
      if (!authHeader.startsWith("Bearer ")) return null
      const token = authHeader.replace("Bearer ", "")
      const jwt = decodeJwt(token)
      if (!jwt?.sub) return null
      return { userId: jwt.sub, email: jwt.email?.toLowerCase() ?? null }
    },
    checkQuota: (userId, email) => checkQuota(serviceClient, userId, email, "quick_workout"),
    fetchCatalog: (eq, mg) => fetchCatalog(serviceClient, eq, mg),
    fetchProfile: (userId) => fetchProfile(serviceClient, userId),
    fetchRecentHistory: (userId) => fetchRecentHistory(serviceClient, userId),
    callGemini,
    async logBillableCall(userId) {
      const { error } = await serviceClient
        .from("ai_generation_log")
        .insert({ user_id: userId, source: "quick_workout" })
      if (error) {
        throw new Error(`logBillableCall insert failed: ${error.message ?? "unknown"}`)
      }
    },
    log: emitLog,
  })
})
