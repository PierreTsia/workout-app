import { corsHeaders } from "../_shared/cors.ts"
import { createUserClient } from "../_shared/supabase.ts"
import {
  getActiveThread,
  getOrCreateActiveThread,
  markStaleIfDue,
  setStatus,
  type SupabaseLike,
  type Thread,
  type ThreadLocale,
} from "./threadStore.ts"
import { handleEmbeddedAgent, type LogEvent } from "./handler.ts"

/**
 * Embedded Agent edge function (T117). Currently exposes a single `POST` route
 * keyed off `body.action`:
 *
 *   - `{ action: "open", locale: "en" | "fr" }` → resume or create the user's
 *     active onboarding thread. Returns `{ thread_id, status, resumed,
 *     messages }`. Performs the lazy 7d staleness sweep on resume.
 *   - `{ action: "abandon" }` → mark the user's active thread abandoned.
 *     Idempotent when there is none.
 *
 * Future routes for `/message`, `/draft`, `/commit` (T118-T120) will branch
 * here off the same Deno.serve.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  // The narrow `SupabaseLike` interface in threadStore.ts mirrors the chain
  // shape we actually use; the real client returns wider types per call. We
  // cast at the boundary so unit tests stay decoupled from supabase-js.
  const supabase = createUserClient(
    req.headers.get("Authorization") ?? "",
  ) as unknown as SupabaseLike

  const res = await handleEmbeddedAgent(req, {
    getUser: async (authHeader) => {
      if (!authHeader) return null
      const userScoped = createUserClient(authHeader)
      const { data, error } = await userScoped.auth.getUser()
      if (error || !data.user?.id) return null
      return { userId: data.user.id }
    },
    getActiveThread: (userId: string) => getActiveThread(supabase, userId),
    getOrCreateActiveThread: (userId: string, locale: ThreadLocale) =>
      getOrCreateActiveThread(supabase, userId, locale),
    markStaleIfDue: (thread: Thread) => markStaleIfDue(supabase, thread),
    setStatusToAbandoned: (thread: Thread) => setStatus(supabase, thread, "abandoned"),
    log: emitLog,
  })

  const merged = new Headers(res.headers)
  for (const [k, v] of Object.entries(corsHeaders)) merged.set(k, v)
  return new Response(res.body, { status: res.status, headers: merged })
})

function emitLog(event: LogEvent): void {
  const payload = JSON.stringify({ ts: new Date().toISOString(), ...event })
  if (event.level === "error") console.error(payload)
  else console.warn(payload)
}
