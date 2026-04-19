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

const SERVER_INFO = { name: "gymlogic", version: "0.1.0" }
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

      const supabase = authHeader.startsWith("Bearer ")
        ? createUserClient(authHeader)
        : null

      const result = await resource.handler(supabase)
      return ok(id, result)
    }

    case "tools/call": {
      const name = params?.name as string
      const args = (params?.arguments ?? {}) as Record<string, unknown>
      const tool = toolRegistry.get(name)
      if (!tool) return fail(id, -32601, `Unknown tool: ${name}`)

      const supabase = authHeader.startsWith("Bearer ")
        ? createUserClient(authHeader)
        : null

      const result = await tool.handler(args, supabase)
      return ok(id, result)
    }

    default:
      return fail(id, -32601, `Method not found: ${method}`)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders })

  if (req.method === "DELETE")
    return new Response(null, { status: 200, headers: corsHeaders })

  if (req.method !== "POST")
    return json(fail(null, -32600, "Only POST is supported"), 405)

  try {
    const body = await req.json()
    const authHeader = req.headers.get("Authorization") ?? ""

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
