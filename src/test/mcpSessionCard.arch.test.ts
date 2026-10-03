import { describe, expect, it } from "vitest"

/**
 * The Session Card **MCP App View** contract (ADR 0027, T284): a read-only `ui://gymlogic/…`
 * resource served as `text/html;profile=mcp-app`, referenced by a dedicated tool via
 * `_meta.ui.resourceUri`, with a committed view artifact guarded by `view:check`. This test
 * pins the contract at the source level — a rename or a dropped `meta` would ship a view no
 * host renders, invisible in a diff.
 */
const sources = import.meta.glob(
  [
    "../../supabase/functions/mcp/resources/registry.ts",
    "../../supabase/functions/mcp/resources/sessionCardView.ts",
    "../../supabase/functions/mcp/resources/views/sessionCard.generated.ts",
    "../../supabase/functions/mcp/tools/registry.ts",
    "../../supabase/functions/mcp/tools/renderSessionCard.ts",
    "../../scripts/build-mcp-view.mjs",
    "../../package.json",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const viewSource = sources["../../supabase/functions/mcp/resources/sessionCardView.ts"]
const viewArtifact = sources["../../supabase/functions/mcp/resources/views/sessionCard.generated.ts"]
const resourcesRegistry = sources["../../supabase/functions/mcp/resources/registry.ts"]
const toolSource = sources["../../supabase/functions/mcp/tools/renderSessionCard.ts"]
const toolsRegistry = sources["../../supabase/functions/mcp/tools/registry.ts"]
const buildScript = sources["../../scripts/build-mcp-view.mjs"]
const packageJson = sources["../../package.json"]

describe("Session Card MCP App View", () => {
  it("serves ui://gymlogic/session-card as text/html;profile=mcp-app", () => {
    expect(viewSource).toMatch(/ui:\/\/gymlogic\/session-card/)
    expect(viewSource).toMatch(/text\/html;profile=mcp-app/)
  })

  it("registers the view resource", () => {
    expect(resourcesRegistry).toMatch(/sessionCardView/)
  })

  it("references the view from the tool via _meta.ui.resourceUri", () => {
    expect(toolSource).toMatch(/resourceUri:\s*URI/)
    expect(toolSource).toMatch(/ui:\/\/gymlogic\/session-card/)
    expect(toolsRegistry).toMatch(/renderSessionCard/)
  })

  it("is read-only: the tool never writes", () => {
    expect(toolSource).toMatch(/readOnlyHint:\s*true/)
    expect(toolSource).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
  })

  it("ships a committed, self-sufficient artifact carrying the GL skin", () => {
    expect(viewArtifact).toMatch(/export const SESSION_CARD_HTML/)
    expect(viewArtifact).toMatch(/--nomos-color/)
    expect(viewArtifact).toMatch(/174 100% 39%/)
  })

  it("guards the artifact against drift (view:check) and reuses the published utilities", () => {
    expect(buildScript).toMatch(/--check/)
    expect(buildScript).toMatch(/@nomosui\/react\/view\.css/)
    expect(packageJson).toMatch(/"view:check":/)
  })
})
