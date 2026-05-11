// Production wiring for the commit-quick-workout Edge function (T128, #342).
// Thin shell — DI wiring + Deno.serve. All logic lives in `handler.ts`.
//
// The user's session JWT is captured here and forwarded to MCP on the
// `callMcp` closure: same auth surface as the user's own DB writes, so
// RLS applies inside `create_workout_day` (the tool inserts under the
// caller's identity, not the service role).

import { decodeJwt } from "../_shared/aiQuota.ts"
import { callMcpTool, resolveMcpUrl } from "../_shared/mcpClient.ts"
import { handleCommitQuickWorkout } from "./handler.ts"
import { emitLog } from "./log.ts"

Deno.serve((req) => {
  const authHeader = req.headers.get("Authorization") ?? ""
  // Capture the bearer token once, in this closure, so handler.ts never
  // sees the raw header. If the token is malformed, getUser will reject
  // before callMcp is ever invoked.
  const tokenPart = authHeader.replace("Bearer ", "")

  return handleCommitQuickWorkout(req, {
    async getUser(header) {
      if (!header.startsWith("Bearer ")) return null
      const token = header.replace("Bearer ", "")
      const jwt = decodeJwt(token)
      if (!jwt?.sub) return null
      return { userId: jwt.sub }
    },
    callMcp: (args) =>
      callMcpTool({
        mcpUrl: resolveMcpUrl(),
        userAccessToken: tokenPart,
        toolName: "create_workout_day",
        arguments: args as unknown as Record<string, unknown>,
      }),
    log: emitLog,
  })
})
