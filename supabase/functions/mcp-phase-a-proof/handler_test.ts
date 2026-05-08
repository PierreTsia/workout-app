import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  handlePhaseAProof,
  type LogEvent,
  type PhaseAProofDeps,
} from "./handler.ts"
import type { CallMcpToolArgs, CallMcpToolResult } from "../_shared/mcpClient.ts"

function makeDeps(overrides: Partial<PhaseAProofDeps> = {}): PhaseAProofDeps {
  return {
    mcpUrl: "https://mcp.test/functions/v1/mcp",
    getUser: async () => ({ userId: "user_abc" }),
    callMcp: async (): Promise<CallMcpToolResult> => ({
      ok: true,
      value: { content: [{ type: "text", text: "preview ok" }] },
    }),
    log: () => {},
    ...overrides,
  }
}

function captureLogs(): { events: LogEvent[]; log: (e: LogEvent) => void } {
  const events: LogEvent[] = []
  return { events, log: (e) => events.push(e) }
}

function makeRequest(body: unknown, authHeader = "Bearer jwt_test"): Request {
  return new Request("https://edge.test/mcp-phase-a-proof", {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

Deno.test("does not emit any log on the success path", async () => {
  const { events, log } = captureLogs()
  const deps = makeDeps({ log })

  const res = await handlePhaseAProof(makeRequest({ name: "Sample" }), deps)

  assertEquals(res.status, 200)
  assertEquals(events.length, 0)
})

Deno.test("returns 400 invalid_body when JSON body cannot be parsed", async () => {
  const { events, log } = captureLogs()
  let callMcpInvoked = false
  const deps = makeDeps({
    log,
    callMcp: async () => {
      callMcpInvoked = true
      return { ok: true, value: { content: [] } }
    },
  })

  const req = new Request("https://edge.test/mcp-phase-a-proof", {
    method: "POST",
    headers: {
      Authorization: "Bearer jwt_test",
      "Content-Type": "application/json",
    },
    body: "{not json",
  })
  const res = await handlePhaseAProof(req, deps)

  assertEquals(res.status, 400)
  const json = await res.json()
  assertEquals(json.error, "invalid_body")
  assertEquals(callMcpInvoked, false)
  assertEquals(events.length, 1)
  assertEquals(events[0].error_kind, "invalid_body")
  assertEquals(events[0].user_id, "user_abc")
})

Deno.test("returns 400 invalid_body when body is not a JSON object", async () => {
  const { events, log } = captureLogs()
  const deps = makeDeps({ log })
  const res = await handlePhaseAProof(makeRequest(null), deps)

  assertEquals(res.status, 400)
  const json = await res.json()
  assertEquals(json.error, "invalid_body")
  assertEquals(events.length, 1)
  assertEquals(events[0].error_kind, "invalid_body")
})

Deno.test("logs MCP failure with user_id, kind, and message", async () => {
  const { events, log } = captureLogs()
  const deps = makeDeps({
    log,
    callMcp: async () => ({
      ok: false,
      kind: "tool_error",
      message: "exercise_id not in catalog",
    }),
  })

  await handlePhaseAProof(makeRequest({ name: "Sample" }), deps)

  assertEquals(events.length, 1)
  assertEquals(events[0].error_kind, "tool_error")
  assertEquals(events[0].user_id, "user_abc")
  assertEquals(events[0].message, "exercise_id not in catalog")
})

Deno.test("logs persist_not_allowed event with user_id when body sends dry_run:false", async () => {
  const { events, log } = captureLogs()
  const deps = makeDeps({ log })

  await handlePhaseAProof(makeRequest({ dry_run: false }), deps)

  assertEquals(events.length, 1)
  assertEquals(events[0].error_kind, "persist_not_allowed")
  assertEquals(events[0].user_id, "user_abc")
})

Deno.test("logs structured error event on invalid_session (getUser returns null)", async () => {
  const { events, log } = captureLogs()
  const deps = makeDeps({ log, getUser: async () => null })

  const req = new Request("https://edge.test/mcp-phase-a-proof", {
    method: "POST",
    headers: { Authorization: "Bearer expired", "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  await handlePhaseAProof(req, deps)

  assertEquals(events.length, 1)
  assertEquals(events[0].error_kind, "invalid_session")
  assertEquals(events[0].user_id, undefined)
})

Deno.test("propagates x-request-id header into log event when supplied", async () => {
  const { events, log } = captureLogs()
  const deps = makeDeps({ log })
  const req = new Request("https://edge.test/mcp-phase-a-proof", {
    method: "POST",
    headers: { "x-request-id": "trace_xyz_42", "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })

  await handlePhaseAProof(req, deps)

  assertEquals(events.length, 1)
  assertEquals(events[0].request_id, "trace_xyz_42")
})

Deno.test("logs structured error event on auth_missing (no Bearer header)", async () => {
  const { events, log } = captureLogs()
  const deps = makeDeps({ log })
  const req = new Request("https://edge.test/mcp-phase-a-proof", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })

  await handlePhaseAProof(req, deps)

  assertEquals(events.length, 1)
  const ev = events[0]
  assertEquals(ev.level, "error")
  assertEquals(ev.feature, "mcp-phase-a-proof")
  assertEquals(ev.error_kind, "auth_missing")
  assertEquals(typeof ev.request_id === "string" && ev.request_id.length > 0, true)
  assertEquals(ev.user_id, undefined)
})

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
