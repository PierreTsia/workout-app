type JsonRpcId = string | number

type JsonRpcError = { code: number; message: string; data?: unknown }

type McpToolTextContent = { type: "text"; text: string }
type McpToolContent = { type: string; text?: string }

export type McpToolResult = {
  content: McpToolContent[]
  isError?: boolean
}

type JsonRpcSuccess = { jsonrpc: "2.0"; id: JsonRpcId; result: McpToolResult }
type JsonRpcFailure = { jsonrpc: "2.0"; id: JsonRpcId; error: JsonRpcError }
type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure

export type CallMcpToolOk = { ok: true; value: McpToolResult }
export type CallMcpToolErr =
  | { ok: false; kind: "rpc_error"; rpc: JsonRpcError }
  | { ok: false; kind: "tool_error"; message: string }
  | { ok: false; kind: "transport_error"; message: string }

export type CallMcpToolResult = CallMcpToolOk | CallMcpToolErr

export type CallMcpToolArgs = {
  mcpUrl: string
  userAccessToken: string
  toolName: string
  arguments: Record<string, unknown>
}

function extractToolText(result: McpToolResult): string {
  return (result.content ?? [])
    .filter((c): c is McpToolTextContent => c?.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n")
}

/**
 * Resolves the MCP server URL for server-to-server JSON-RPC calls. The
 * order matters: `MCP_URL` overrides everything (test / staging / future
 * external host), then we fall back to the internal Supabase function URL
 * that lives next door. We intentionally do NOT use the public
 * Cloudflare-fronted `https://mcp.gymlogic.me/...` host — same auth
 * (Bearer JWT) but a CDN hop and public DNS dependency we don't need
 * inside the data plane.
 *
 * Throws if neither env var is set so misconfiguration surfaces at boot,
 * not on the first commit attempt.
 */
export function resolveMcpUrl(): string {
  const explicit = Deno.env.get("MCP_URL")
  if (explicit) return explicit
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  if (!supabaseUrl) {
    throw new Error("MCP_URL or SUPABASE_URL must be set")
  }
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/mcp`
}

export async function callMcpTool(args: CallMcpToolArgs): Promise<CallMcpToolResult> {
  try {
    const body = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: args.toolName, arguments: args.arguments },
    } as const

    const res = await fetch(args.mcpUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.userAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const payload = (await res.json()) as JsonRpcResponse

    if ("error" in payload) {
      return { ok: false, kind: "rpc_error", rpc: payload.error }
    }

    if (payload.result?.isError) {
      return { ok: false, kind: "tool_error", message: extractToolText(payload.result) }
    }

    return { ok: true, value: payload.result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, kind: "transport_error", message }
  }
}

