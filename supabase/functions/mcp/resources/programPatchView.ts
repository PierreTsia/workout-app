import type { ResourceDefinition } from "./registry.ts"
import { PROGRAM_PATCH_HTML } from "./views/programPatch.generated.ts"

const URI = "ui://gymlogic/program-patch"
const MIME = "text/html;profile=mcp-app"

/**
 * The **Decision Card** MCP App View (ADR 0028): a self-sufficient HTML document an MCP
 * Apps host renders in a sandboxed iframe. Served without auth — the document is static;
 * the `update_program` preview reaches the view through the tool-result push, and the Apply
 * button asks the host to call `apply_program_patch` (`tools/call`).
 */
export const programPatchView: ResourceDefinition = {
  uri: URI,
  name: "Program change",
  description:
    "A card that previews an update_program change and lets the athlete apply it, rendered by an MCP Apps host.",
  mimeType: MIME,

  async handler() {
    return {
      contents: [{ uri: URI, mimeType: MIME, text: PROGRAM_PATCH_HTML }],
    }
  },
}
