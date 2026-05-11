// Pure handler for the commit-quick-workout Edge function (T128, #342).
//
// Purpose: receive a confirmed Quick Workout from the PWA (already
// previewed via /generate-quick-workout) and persist it via the
// `create_workout_day` MCP tool. The split exists because:
//   1. /generate is idempotent (read-only model call); this is the
//      mutator. Different retry policies, different metrics, different
//      blast radius if it 500s mid-flight.
//   2. The MCP tool is the only sanctioned write path for ad-hoc days,
//      so external clients (Claude, ChatGPT) and the PWA hit the same
//      validation surface — no useCreateQuickWorkout drift.
//
// No quota: the LLM call already burned a `quick_workout` row in
// /generate. Committing the *same* preview twice is a UX bug, not a
// quota event.
//
// Auth: forwards the user's session JWT to MCP so RLS applies inside
// the tool (workout_days INSERT goes through the user's own context).
// The MCP server itself accepts both PATs and session JWTs (authLogic.ts).

import { corsHeaders } from "../_shared/cors.ts"
import type { CallMcpToolResult, McpToolResult } from "../_shared/mcpClient.ts"
import type { LogEvent } from "./log.ts"

export type { LogEvent } from "./log.ts"

const MAX_EXERCISES = 20

export interface CommitQuickWorkoutDeps {
  /** Verifies the Authorization header and returns the userId on success. */
  getUser: (authHeader: string) => Promise<{ userId: string } | null>
  /**
   * Calls the `create_workout_day` MCP tool with `dry_run: false`. The
   * caller (index.ts) wires the URL + Bearer token in a closure so the
   * handler stays sink-agnostic.
   */
  callMcp: (args: {
    label: string
    exercises: Array<string | Record<string, unknown>>
    dry_run: false
  }) => Promise<CallMcpToolResult>
  log: (event: LogEvent) => void
}

interface ParsedBody {
  label: string
  exercises: Array<string | Record<string, unknown>>
}

function parseBody(body: Record<string, unknown>): ParsedBody | { error: string } {
  if (typeof body.label !== "string" || body.label.trim() === "") {
    return { error: "Missing or invalid label" }
  }
  const exs = body.exercises
  if (!Array.isArray(exs) || exs.length === 0) {
    return { error: "exercises must be a non-empty array" }
  }
  if (exs.length > MAX_EXERCISES) {
    return { error: `exercises capped at ${MAX_EXERCISES} entries` }
  }
  // Per-entry shape: a UUID string OR a row-shaped object. Deeper field
  // validation lives in the MCP tool — we just gate the obvious-broken
  // payloads here so a typo in the client doesn't cost an MCP roundtrip.
  const allShapesOk = exs.every(
    (e) => typeof e === "string" || (typeof e === "object" && e !== null && !Array.isArray(e)),
  )
  if (!allShapesOk) {
    return { error: "Each exercise must be a string id or an object" }
  }
  return {
    label: body.label.trim(),
    exercises: exs as Array<string | Record<string, unknown>>,
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

/**
 * Parse the `workout_day_id` out of the MCP create_workout_day success
 * response. Mirrors `parseProgramIdFromMcpResult` in embedded-agent — the
 * tool returns a single text content with a JSON body. Defensive parse
 * lets us 502 on malformed payloads instead of leaking `undefined` to
 * the client.
 */
function parseWorkoutDayIdFromMcpResult(result: McpToolResult): string | null {
  const text = (result.content ?? [])
    .filter(
      (c): c is { type: "text"; text: string } =>
        c?.type === "text" && typeof c.text === "string",
    )
    .map((c) => c.text)
    .join("\n")
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const id = parsed.workout_day_id
    return typeof id === "string" ? id : null
  } catch {
    return null
  }
}

export async function handleCommitQuickWorkout(
  req: Request,
  deps: CommitQuickWorkoutDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()

  const authHeader = req.headers.get("Authorization") ?? ""
  const user = await deps.getUser(authHeader)
  if (!user) {
    deps.log({
      level: "warn",
      feature: "commit-quick-workout",
      route: "/commit",
      error_kind: "auth_missing",
      request_id: requestId,
    })
    return jsonResponse({ error: "auth_missing" }, 401)
  }
  const { userId } = user

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const parsed = parseBody(body)
  if ("error" in parsed) return jsonResponse({ error: parsed.error }, 400)

  // Lock-step with the MCP contract: dry_run: false is the *only* place
  // a workout_day row can be written from the Quick Workout AI flow. The
  // MCP server gates writes on this flag, so passing it explicitly is
  // both honest and safe.
  const mcpResult = await deps.callMcp({
    label: parsed.label,
    exercises: parsed.exercises,
    dry_run: false,
  })

  if (!mcpResult.ok) {
    deps.log({
      level: "error",
      feature: "commit-quick-workout",
      route: "/commit",
      error_kind: `mcp_${mcpResult.kind}`,
      request_id: requestId,
      user_id: userId,
      message: "message" in mcpResult ? mcpResult.message : undefined,
    })
    return jsonResponse(
      { error: "commit_failed", kind: mcpResult.kind },
      502,
    )
  }

  const workoutDayId = parseWorkoutDayIdFromMcpResult(mcpResult.value)
  if (!workoutDayId) {
    // Tool returned 200 but the payload doesn't carry the id — same
    // canonical "tool-side contract break" as embedded-agent's commit
    // path treats it.
    deps.log({
      level: "error",
      feature: "commit-quick-workout",
      route: "/commit",
      error_kind: "mcp_tool_error",
      request_id: requestId,
      user_id: userId,
      message: "create_workout_day returned no workout_day_id",
    })
    return jsonResponse(
      { error: "commit_failed", kind: "invalid_response" },
      502,
    )
  }

  deps.log({
    level: "info",
    feature: "commit-quick-workout",
    route: "/commit",
    request_id: requestId,
    user_id: userId,
    message: "quick_workout_committed",
  })

  return jsonResponse({ workout_day_id: workoutDayId }, 200)
}
