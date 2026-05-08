type JsonRpcError = { code: number; message: string; data?: unknown }

type McpToolTextContent = { type: "text"; text: string }
type McpToolContent = { type: string; text?: string }

type McpToolResult = {
  content: McpToolContent[]
  isError?: boolean
}

type JsonRpcSuccess = { jsonrpc: "2.0"; id: number; result: McpToolResult }
type JsonRpcFailure = { jsonrpc: "2.0"; id: number; error: JsonRpcError }
type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure

export type CallMcpToolOk = { ok: true; value: McpToolResult }
export type CallMcpToolErr =
  | { ok: false; kind: "rpc_error"; rpc: JsonRpcError }
  | { ok: false; kind: "tool_error"; message: string }
  | { ok: false; kind: "transport_error"; message: string }

export type CallMcpToolResult = CallMcpToolOk | CallMcpToolErr

type CallMcpToolArgs = {
  mcpUrl: string
  userAccessToken: string
  toolName: string
  arguments: Record<string, unknown>
}

let nextId = 1

function extractToolText(result: McpToolResult): string {
  return (result.content ?? [])
    .filter((c): c is McpToolTextContent => c?.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n")
}

export async function callMcpTool(args: CallMcpToolArgs): Promise<CallMcpToolResult> {
  try {
    const id = nextId++
    const body = {
      jsonrpc: "2.0",
      id,
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

