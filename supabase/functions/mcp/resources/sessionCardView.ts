import type { ResourceDefinition } from "./registry.ts"
import { SESSION_CARD_HTML } from "./views/sessionCard.generated.ts"

const URI = "ui://gymlogic/session-card"
const MIME = "text/html;profile=mcp-app"

/**
 * The Session Card **MCP App View** (ADR 0027): a self-sufficient, read-only HTML document
 * an MCP Apps host renders in a sandboxed iframe. Served without auth — the document is
 * static; the per-athlete data reaches the view through the tool-result push (T285).
 */
export const sessionCardView: ResourceDefinition = {
  uri: URI,
  name: "Session Card",
  description:
    "A read-only card of the athlete's most recent finished session, rendered by an MCP Apps host.",
  mimeType: MIME,

  async handler() {
    return {
      contents: [{ uri: URI, mimeType: MIME, text: SESSION_CARD_HTML }],
    }
  },
}
