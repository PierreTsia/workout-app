import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { callMcpTool } from "./mcpClient.ts"

const ORIGINAL_FETCH = globalThis.fetch

function stubFetch(
  handler: (req: Request) => Promise<Response> | Response,
) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const req =
      input instanceof Request
        ? input
        : new Request(String(input), init)
    return Promise.resolve(handler(req))
  }) as typeof fetch
}

type CapturedBody = {
  jsonrpc: string
  id: unknown
  method: string
  params: { name: string; arguments: Record<string, unknown> }
}

Deno.test("callMcpTool builds tools/call JSON-RPC envelope + Bearer header", async () => {
  const seen: { url?: string; auth?: string; body?: CapturedBody } = {}
  stubFetch(async (req) => {
    seen.url = req.url
    seen.auth = req.headers.get("Authorization") ?? undefined
    seen.body = (await req.json()) as CapturedBody
    return Response.json({
      jsonrpc: "2.0",
      id: seen.body.id,
      result: { content: [{ type: "text", text: "ok" }] },
    })
  })

  try {
    const result = await callMcpTool({
      mcpUrl: "https://example.test/functions/v1/mcp",
      userAccessToken: "jwt_123",
      toolName: "create_program",
      arguments: { dry_run: true },
    })

    assertEquals(result.ok, true)
    assertEquals(seen.url, "https://example.test/functions/v1/mcp")
    assertEquals(seen.auth, "Bearer jwt_123")
    assertEquals(seen.body?.jsonrpc, "2.0")
    assertEquals(seen.body?.method, "tools/call")
    assertEquals(seen.body?.params, {
      name: "create_program",
      arguments: { dry_run: true },
    })
    assertEquals(typeof seen.body?.id === "string" && seen.body.id.length > 0, true)
  } finally {
    globalThis.fetch = ORIGINAL_FETCH
  }
})

Deno.test("callMcpTool maps JSON-RPC error to ok:false", async () => {
  stubFetch(() =>
    Response.json({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32601, message: "Method not found" },
    })
  )

  try {
    const result = await callMcpTool({
      mcpUrl: "https://example.test/functions/v1/mcp",
      userAccessToken: "jwt_123",
      toolName: "nope",
      arguments: {},
    })
    assertEquals(result.ok, false)
    if (result.ok) throw new Error("expected ok:false")
    assertEquals(result.kind, "rpc_error")
    if (result.kind !== "rpc_error") throw new Error("expected rpc_error")
    assertEquals(result.rpc.code, -32601)
  } finally {
    globalThis.fetch = ORIGINAL_FETCH
  }
})

Deno.test("callMcpTool maps tool isError to ok:false", async () => {
  stubFetch(() =>
    Response.json({
      jsonrpc: "2.0",
      id: 1,
      result: { isError: true, content: [{ type: "text", text: "bad input" }] },
    })
  )

  try {
    const result = await callMcpTool({
      mcpUrl: "https://example.test/functions/v1/mcp",
      userAccessToken: "jwt_123",
      toolName: "create_program",
      arguments: { name: "" },
    })
    assertEquals(result.ok, false)
    if (result.ok) throw new Error("expected ok:false")
    assertEquals(result.kind, "tool_error")
    if (result.kind !== "tool_error") throw new Error("expected tool_error")
    assertEquals(result.message.includes("bad input"), true)
  } finally {
    globalThis.fetch = ORIGINAL_FETCH
  }
})

