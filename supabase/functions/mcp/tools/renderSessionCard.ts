import type { ToolDefinition } from "./registry.ts"

const URI = "ui://gymlogic/session-card"

/**
 * Show the athlete's most recent finished session as an **MCP App View** (ADR 0027).
 * Read-only: the card never writes. T284 returns a text summary with example data; T285
 * binds it to the real last session.
 */
export const renderSessionCard: ToolDefinition = {
  name: "render_session_card",
  description:
    "Show the athlete's most recent finished training session as a card in the conversation (MCP Apps). Read-only; falls back to a text summary on clients that ignore `_meta`.",
  annotations: {
    title: "Show session card",
    readOnlyHint: true,
    idempotentHint: true,
  },
  meta: { ui: { resourceUri: URI } },
  inputSchema: {
    type: "object",
    properties: {},
  },

  async handler() {
    return {
      content: [
        {
          type: "text",
          text: "## Last session\n\nThe Session Card is rendered in MCP Apps hosts.",
        },
      ],
    }
  },
}
