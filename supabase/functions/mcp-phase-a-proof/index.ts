import { corsHeaders } from "../_shared/cors.ts"
import { createUserClient } from "../_shared/supabase.ts"
import { callMcpTool } from "../_shared/mcpClient.ts"
import { handlePhaseAProof } from "./handler.ts"

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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const mcpUrl = resolveMcpUrl()
  if (!mcpUrl) {
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
    log: (event) => {
      // Single-line JSON keeps Supabase log explorer / grep friendly. We
      // avoid console.error here because the runtime would inject a stack
      // and call the line "Edge function error" — these are *expected*
      // structured events, not unhandled crashes.
      const payload = JSON.stringify({ ts: new Date().toISOString(), ...event })
      if (event.level === "error") console.error(payload)
      else console.warn(payload)
    },
  })

  // Re-emit headers with CORS — handler returns plain Response.json, we layer
  // CORS on top here so the handler stays portable / framework-agnostic.
  const merged = new Headers(res.headers)
  for (const [k, v] of Object.entries(corsHeaders)) merged.set(k, v)
  return new Response(res.body, { status: res.status, headers: merged })
})

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
