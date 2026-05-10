// Behavioral tests for commit-quick-workout/handler.ts (T128, #342).
//
// Strategy: dependency-injected fakes for `getUser`, `callMcp`, `log`. We
// exercise the handler via `Request` like the real Deno.serve runtime does,
// so the contract under test is the wire one (status code + JSON body).
//
// Each test covers a distinct behavioral lock-in:
//   1. Auth missing → 401, no MCP call.
//   2. Body shape: missing label → 400.
//   3. Body shape: empty exercises[] → 400.
//   4. Body shape: > 20 exercises → 400.
//   5. Body shape: malformed exercise entry → 400.
//   6. MCP rpc_error → 502 with kind: "rpc_error", structured log.
//   7. MCP tool_error → 502 with kind: "tool_error".
//   8. MCP transport_error → 502 with kind: "transport_error".
//   9. MCP success but no workout_day_id in payload → 502 invalid_response.
//  10. Happy path → 200 with workout_day_id.

import { assertEquals, assertExists } from "jsr:@std/assert@1.0.6"
import {
  handleCommitQuickWorkout,
  type CommitQuickWorkoutDeps,
  type LogEvent,
} from "./handler.ts"
import type { CallMcpToolResult } from "../_shared/mcpClient.ts"

const VALID_UUID = "11111111-1111-1111-1111-111111111111"
const ANOTHER_UUID = "22222222-2222-2222-2222-222222222222"

interface FakeDepsOptions {
  user?: { userId: string } | null
  mcpResult?: CallMcpToolResult
  callMcpSpy?: (args: unknown) => void
}

function buildDeps(opts: FakeDepsOptions = {}): CommitQuickWorkoutDeps & {
  logs: LogEvent[]
} {
  const logs: LogEvent[] = []
  const defaultMcp: CallMcpToolResult = {
    ok: true,
    value: {
      content: [
        { type: "text", text: JSON.stringify({ workout_day_id: VALID_UUID }) },
      ],
    },
  }
  return {
    logs,
    getUser: () =>
      Promise.resolve(
        opts.user === undefined ? { userId: VALID_UUID } : opts.user,
      ),
    callMcp: (args) => {
      opts.callMcpSpy?.(args)
      return Promise.resolve(opts.mcpResult ?? defaultMcp)
    },
    log: (event) => {
      logs.push(event)
    },
  }
}

function buildRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/commit-quick-workout", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

// ─── 1. Auth ──────────────────────────────────────────────────────────────────

Deno.test("returns 401 when getUser yields null", async () => {
  let mcpCalled = false
  const deps = buildDeps({
    user: null,
    callMcpSpy: () => {
      mcpCalled = true
    },
  })

  const res = await handleCommitQuickWorkout(
    buildRequest({ label: "x", exercises: [VALID_UUID] }),
    deps,
  )

  assertEquals(res.status, 401)
  assertEquals(mcpCalled, false)
})

// ─── 2-5. Body shape ──────────────────────────────────────────────────────────

Deno.test("returns 400 when label is missing or not a string", async () => {
  const deps = buildDeps()
  const res = await handleCommitQuickWorkout(
    buildRequest({ exercises: [VALID_UUID] }),
    deps,
  )
  assertEquals(res.status, 400)
  const json = (await res.json()) as { error: string }
  assertExists(json.error)
})

Deno.test("returns 400 when exercises is empty", async () => {
  const deps = buildDeps()
  const res = await handleCommitQuickWorkout(
    buildRequest({ label: "Push day", exercises: [] }),
    deps,
  )
  assertEquals(res.status, 400)
})

Deno.test("returns 400 when exercises has > 20 entries", async () => {
  const deps = buildDeps()
  const tooMany = Array.from({ length: 21 }, () => VALID_UUID)
  const res = await handleCommitQuickWorkout(
    buildRequest({ label: "Big day", exercises: tooMany }),
    deps,
  )
  assertEquals(res.status, 400)
})

Deno.test("returns 400 when an exercise entry is neither string nor object", async () => {
  const deps = buildDeps()
  const res = await handleCommitQuickWorkout(
    buildRequest({ label: "Push", exercises: [VALID_UUID, 42] }),
    deps,
  )
  assertEquals(res.status, 400)
})

// ─── 6-8. MCP errors ──────────────────────────────────────────────────────────

Deno.test("MCP rpc_error → 502 with kind=rpc_error and structured log", async () => {
  const deps = buildDeps({
    mcpResult: {
      ok: false,
      kind: "rpc_error",
      rpc: { code: -32000, message: "boom" },
    },
  })
  const res = await handleCommitQuickWorkout(
    buildRequest({ label: "x", exercises: [VALID_UUID] }),
    deps,
  )
  assertEquals(res.status, 502)
  const json = (await res.json()) as { error: string; kind: string }
  assertEquals(json.error, "commit_failed")
  assertEquals(json.kind, "rpc_error")
  assertEquals(deps.logs.some((l) => l.error_kind === "mcp_rpc_error"), true)
})

Deno.test("MCP tool_error → 502 with kind=tool_error", async () => {
  const deps = buildDeps({
    mcpResult: { ok: false, kind: "tool_error", message: "exercise_id not found" },
  })
  const res = await handleCommitQuickWorkout(
    buildRequest({ label: "x", exercises: [VALID_UUID] }),
    deps,
  )
  assertEquals(res.status, 502)
  const json = (await res.json()) as { error: string; kind: string }
  assertEquals(json.kind, "tool_error")
})

Deno.test("MCP transport_error → 502 with kind=transport_error", async () => {
  const deps = buildDeps({
    mcpResult: { ok: false, kind: "transport_error", message: "fetch failed" },
  })
  const res = await handleCommitQuickWorkout(
    buildRequest({ label: "x", exercises: [VALID_UUID] }),
    deps,
  )
  assertEquals(res.status, 502)
  const json = (await res.json()) as { error: string; kind: string }
  assertEquals(json.kind, "transport_error")
})

// ─── 9. MCP success but unparseable payload ───────────────────────────────────

Deno.test("MCP success without workout_day_id → 502 invalid_response", async () => {
  const deps = buildDeps({
    mcpResult: {
      ok: true,
      value: { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] },
    },
  })
  const res = await handleCommitQuickWorkout(
    buildRequest({ label: "x", exercises: [VALID_UUID] }),
    deps,
  )
  assertEquals(res.status, 502)
  const json = (await res.json()) as { error: string; kind: string }
  assertEquals(json.error, "commit_failed")
  assertEquals(json.kind, "invalid_response")
})

// ─── 10. Happy path ───────────────────────────────────────────────────────────

Deno.test("happy path returns 200 with workout_day_id and forwards label+exercises to MCP with dry_run=false", async () => {
  let captured: unknown = null
  const deps = buildDeps({
    callMcpSpy: (args) => {
      captured = args
    },
  })

  const exercises = [VALID_UUID, { exercise_id: ANOTHER_UUID, sets: 3, reps: "10" }]
  const res = await handleCommitQuickWorkout(
    buildRequest({ label: "Push day ⚡", exercises }),
    deps,
  )

  assertEquals(res.status, 200)
  const json = (await res.json()) as { workout_day_id: string }
  assertEquals(json.workout_day_id, VALID_UUID)

  // Handler must forward exactly what the client sent + dry_run:false.
  // No silent transform on label, no shape massage on exercises[] — that's
  // the MCP tool's job.
  const call = captured as { label: string; exercises: unknown[]; dry_run: boolean }
  assertEquals(call.label, "Push day ⚡")
  assertEquals(call.exercises, exercises)
  assertEquals(call.dry_run, false)
})
