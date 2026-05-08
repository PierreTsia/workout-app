import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { handlePhaseAProof, type PhaseAProofDeps } from "./handler.ts"
import type { CallMcpToolArgs, CallMcpToolResult } from "../_shared/mcpClient.ts"

function makeDeps(overrides: Partial<PhaseAProofDeps> = {}): PhaseAProofDeps {
  return {
    mcpUrl: "https://mcp.test/functions/v1/mcp",
    getUser: async (_authHeader: string) => ({ userId: "user_abc" }),
    callMcp: async (_args: CallMcpToolArgs): Promise<CallMcpToolResult> => ({
      ok: true,
      value: { content: [{ type: "text", text: "preview ok" }] },
    }),
    ...overrides,
  }
}

function makeRequest(body: unknown, authHeader = "Bearer jwt_test"): Request {
  return new Request("https://edge.test/mcp-phase-a-proof", {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

Deno.test("returns 502 when MCP returns a transport_error", async () => {
  const deps = makeDeps({
    callMcp: async () => ({
      ok: false,
      kind: "transport_error",
      message: "fetch failed",
    }),
  })

  const res = await handlePhaseAProof(makeRequest({ name: "Sample" }), deps)
  assertEquals(res.status, 502)
  const json = await res.json()
  assertEquals(json.error, "transport_error")
})

Deno.test("returns 502 when MCP returns an rpc_error", async () => {
  const deps = makeDeps({
    callMcp: async () => ({
      ok: false,
      kind: "rpc_error",
      rpc: { code: -32601, message: "Method not found" },
    }),
  })

  const res = await handlePhaseAProof(makeRequest({ name: "Sample" }), deps)
  assertEquals(res.status, 502)
  const json = await res.json()
  assertEquals(json.error, "rpc_error")
})

Deno.test("returns 422 with the tool message when MCP returns a tool_error", async () => {
  const deps = makeDeps({
    callMcp: async () => ({
      ok: false,
      kind: "tool_error",
      message: "exercise_id not in catalog",
    }),
  })

  const req = makeRequest({ name: "Sample" })
  const res = await handlePhaseAProof(req, deps)

  assertEquals(res.status, 422)
  const json = await res.json()
  assertEquals(json.error, "tool_error")
  assertEquals(json.message, "exercise_id not in catalog")
})

Deno.test("rejects body with dry_run:false with 400 (Phase A is preview-only)", async () => {
  let callMcpInvoked = false
  const deps = makeDeps({
    callMcp: async () => {
      callMcpInvoked = true
      return { ok: true, value: { content: [] } }
    },
  })

  const req = makeRequest({ name: "Sample", dry_run: false })
  const res = await handlePhaseAProof(req, deps)

  assertEquals(res.status, 400)
  assertEquals(callMcpInvoked, false)
  const json = await res.json()
  assertEquals(json.error, "persist_not_allowed")
})

Deno.test("returns 401 when getUser rejects the token", async () => {
  let callMcpInvoked = false
  const deps = makeDeps({
    getUser: async () => null,
    callMcp: async () => {
      callMcpInvoked = true
      return { ok: true, value: { content: [] } }
    },
  })

  const req = makeRequest({ name: "Sample" }, "Bearer expired_jwt")
  const res = await handlePhaseAProof(req, deps)

  assertEquals(res.status, 401)
  assertEquals(callMcpInvoked, false)
})

Deno.test("returns 401 when Authorization header is missing", async () => {
  const deps = makeDeps()
  const req = new Request("https://edge.test/mcp-phase-a-proof", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Sample" }),
  })
  const res = await handlePhaseAProof(req, deps)
  assertEquals(res.status, 401)
})

Deno.test("tracer: valid auth + valid body → calls create_program with dry_run:true and returns 200 with MCP payload", async () => {
  let captured: CallMcpToolArgs | null = null
  const deps = makeDeps({
    callMcp: async (args) => {
      captured = args
      return { ok: true, value: { content: [{ type: "text", text: "preview ok" }] } }
    },
  })

  const req = makeRequest({ name: "Sample", days: [{ label: "D1", exercises: [] }] })
  const res = await handlePhaseAProof(req, deps)

  assertEquals(res.status, 200)
  const json = await res.json()
  assertEquals(json, { content: [{ type: "text", text: "preview ok" }] })

  if (!captured) throw new Error("expected callMcp to be called")
  const args = captured as CallMcpToolArgs
  assertEquals(args.mcpUrl, "https://mcp.test/functions/v1/mcp")
  assertEquals(args.userAccessToken, "jwt_test")
  assertEquals(args.toolName, "create_program")
  assertEquals(args.arguments.dry_run, true)
  assertEquals((args.arguments as Record<string, unknown>).name, "Sample")
})
