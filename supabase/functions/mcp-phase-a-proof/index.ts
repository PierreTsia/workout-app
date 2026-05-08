import { corsHeaders } from "../_shared/cors.ts"
import { createUserClient } from "../_shared/supabase.ts"
import { callMcpTool } from "../_shared/mcpClient.ts"
import { handlePhaseAProof, type LogEvent } from "./handler.ts"

const FEATURE = "mcp-phase-a-proof"

/**
 * Phase A proof endpoint (T114). Demonstrates that an Edge Function can act
 * as an MCP client against our own MCP server using the user's Supabase JWT.
 *
 * - Persistence is HARD-DISABLED: any `dry_run:false` in the body is rejected
 *   with 400 server-side. Phase A is preview-only by design.
 * - The MCP target URL is read from MCP_URL (falls back to the canonical
 *   functions/v1/mcp on the same Supabase project).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()

  if (req.method !== "POST") {
    emitLog({
      level: "error",
      feature: FEATURE,
      error_kind: "method_not_allowed",
      request_id: requestId,
      message: req.method,
    })
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const mcpUrl = resolveMcpUrl()
  if (!mcpUrl) {
    emitLog({
      level: "error",
      feature: FEATURE,
      error_kind: "mcp_url_not_configured",
      request_id: requestId,
    })
    return jsonResponse({ error: "mcp_url_not_configured" }, 500)
  }

  const res = await handlePhaseAProof(req, {
    mcpUrl,
    getUser: async (authHeader) => {
      const supabase = createUserClient(authHeader)
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user?.id) return null
      return { userId: data.user.id }
    },
    callMcp: callMcpTool,
    log: emitLog,
  })

  // Re-emit headers with CORS — handler returns plain Response.json, we layer
  // CORS on top here so the handler stays portable / framework-agnostic.
  const merged = new Headers(res.headers)
  for (const [k, v] of Object.entries(corsHeaders)) merged.set(k, v)
  return new Response(res.body, { status: res.status, headers: merged })
})

/**
 * Emit a single-line JSON log line. We route through console.error/warn so
 * that Supabase's log explorer attaches the right severity to each entry —
 * this lets you filter on `level=error` directly in the dashboard. These
 * are *structured events*, not unhandled crashes; the runtime will not
 * decorate them with a stack trace because we never throw.
 */
function emitLog(event: LogEvent): void {
  const payload = JSON.stringify({ ts: new Date().toISOString(), ...event })
  if (event.level === "error") console.error(payload)
  else console.warn(payload)
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function resolveMcpUrl(): string | null {
  const explicit = Deno.env.get("MCP_URL")
  if (explicit) return explicit
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  if (!supabaseUrl) return null
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/mcp`
}
