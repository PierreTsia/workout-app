import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createUserClient } from "./lib/supabaseClient.ts"
import { toolRegistry } from "./tools/registry.ts"
import { resourceRegistry } from "./resources/registry.ts"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const MCP_URL = `${SUPABASE_URL}/functions/v1/mcp`
const AUTH_ISSUER = `${SUPABASE_URL}/auth/v1`

const SERVER_INFO = { name: "gymlogic", version: "0.2.0" }
const PROTOCOL_VERSION = "2025-03-26"

function ok(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0", id, result }
}

function fail(id: string | number | null, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

type Params = Record<string, unknown> | undefined

async function handleRpc(
  method: string,
  params: Params,
  id: string | number | null,
  authHeader: string,
) {
  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {}, resources: {} },
        serverInfo: SERVER_INFO,
      })

    case "notifications/initialized":
      return null

    case "tools/list":
      return ok(id, { tools: toolRegistry.list() })

    case "resources/list":
      return ok(id, { resources: resourceRegistry.list() })

    case "resources/read": {
      const uri = params?.uri as string
      const resource = resourceRegistry.get(uri)
      if (!resource) return fail(id, -32602, `Unknown resource: ${uri}`)

      const result = await resource.handler(createUserClient(authHeader))
      return ok(id, result)
    }

    case "tools/call": {
      const name = params?.name as string
      const args = (params?.arguments ?? {}) as Record<string, unknown>
      const tool = toolRegistry.get(name)
      if (!tool) return fail(id, -32601, `Unknown tool: ${name}`)

      const result = await tool.handler(args, createUserClient(authHeader))
      return ok(id, result)
    }

    default:
      return fail(id, -32601, `Method not found: ${method}`)
  }
}

function json(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  })
}

const RESOURCE_METADATA_URL = `${MCP_URL}/.well-known/oauth-protected-resource`
const WWW_AUTHENTICATE = `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`

async function handleWellKnown(url: URL): Promise<Response | null> {
  const path = url.pathname

  // RFC 9728 — Protected Resource Metadata
  if (path.endsWith("/.well-known/oauth-protected-resource")) {
    return json({
      resource: MCP_URL,
      authorization_servers: [AUTH_ISSUER],
      scopes_supported: [],
      bearer_methods_supported: ["header"],
    })
  }

  // RFC 8414 fallback — proxy Supabase's OAuth AS metadata so clients
  // that don't follow redirects (or probe the MCP URL directly) get a 200.
  if (path.endsWith("/.well-known/oauth-authorization-server")) {
    try {
      const upstream = await fetch(
        `${SUPABASE_URL}/.well-known/oauth-authorization-server/auth/v1`,
      )
      const metadata = await upstream.json()
      return json(metadata)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err) {
      return json({ error: "Failed to fetch authorization server metadata" }, 502)
    }
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders })

  if (req.method === "DELETE")
    return new Response(null, { status: 200, headers: corsHeaders })

  if (req.method === "GET") {
    const wellKnown = await handleWellKnown(new URL(req.url))
    if (wellKnown) return wellKnown
    return json(fail(null, -32600, "Only POST is supported"), 405)
  }

  if (req.method !== "POST")
    return json(fail(null, -32600, "Only POST is supported"), 405)

  const authHeader = req.headers.get("Authorization") ?? ""

  if (!authHeader.startsWith("Bearer ")) {
    return json(
      fail(null, -32000, "Authentication required"),
      401,
      { "WWW-Authenticate": WWW_AUTHENTICATE },
    )
  }

  try {
    const body = await req.json()

    if (Array.isArray(body)) {
      const results = await Promise.all(
        body.map((msg: { method: string; params?: Params; id?: string | number | null }) =>
          handleRpc(msg.method, msg.params, msg.id ?? null, authHeader),
        ),
      )
      return json(results.filter(Boolean))
    }

    const result = await handleRpc(body.method, body.params, body.id ?? null, authHeader)
    if (result === null) return new Response(null, { status: 202, headers: corsHeaders })
    return json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return json(fail(null, -32700, `Parse error: ${message}`), 400)
  }
})
