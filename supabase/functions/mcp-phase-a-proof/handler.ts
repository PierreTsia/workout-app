import type { CallMcpToolArgs, CallMcpToolResult } from "../_shared/mcpClient.ts"

export type LogEvent = {
  level: "error" | "warn"
  feature: string
  error_kind: string
  request_id: string
  user_id?: string
  message?: string
}

export type PhaseAProofDeps = {
  mcpUrl: string
  getUser: (authHeader: string) => Promise<{ userId: string } | null>
  callMcp: (args: CallMcpToolArgs) => Promise<CallMcpToolResult>
  log: (event: LogEvent) => void
}

const FEATURE = "mcp-phase-a-proof"

export async function handlePhaseAProof(
  req: Request,
  deps: PhaseAProofDeps,
): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()
  const logError = (
    error_kind: string,
    extra: { user_id?: string; message?: string } = {},
  ) =>
    deps.log({
      level: "error",
      feature: FEATURE,
      error_kind,
      request_id: requestId,
      ...extra,
    })

  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    logError("auth_missing")
    return Response.json({ error: "missing_authorization" }, { status: 401 })
  }

  // We verify the JWT against Supabase but pass the token straight through to
  // MCP — Phase A proves we can chain the user's identity, not that we can
  // act as them server-side. The userId is intentionally unused here.
  const user = await deps.getUser(authHeader)
  if (!user) {
    logError("invalid_session")
    return Response.json({ error: "invalid_session" }, { status: 401 })
  }

  const token = authHeader.replace(/^Bearer\s+/i, "")
  const body = (await req.json()) as Record<string, unknown>

  if (body.dry_run === false) {
    logError("persist_not_allowed", { user_id: user.userId })
    return Response.json({ error: "persist_not_allowed" }, { status: 400 })
  }

  const result = await deps.callMcp({
    mcpUrl: deps.mcpUrl,
    userAccessToken: token,
    toolName: "create_program",
    arguments: { ...body, dry_run: true },
  })

  if (!result.ok) {
    const status = result.kind === "tool_error" ? 422 : 502
    const message =
      result.kind === "rpc_error" ? result.rpc.message : result.message
    logError(result.kind, { user_id: user.userId, message })
    return Response.json({ error: result.kind, message }, { status })
  }

  return Response.json(result.value, { status: 200 })
}
