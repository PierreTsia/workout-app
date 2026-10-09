import { describe, expect, it } from "vitest"

/**
 * The Decision Card contract (ADR 0028): a `ui://gymlogic/…` resource served as
 * `text/html;profile=mcp-app`, referenced by `update_program`'s dry run, applied through an
 * **app-only** tool that requires a preview token, with **no** direct write path from any
 * view. A dropped `_meta`, a rename, or a stray `fetch`/`insert` would ship a view that
 * either never renders or writes behind the host's back — invisible in a diff.
 */
const sources = import.meta.glob(
  [
    "../../supabase/functions/mcp/resources/registry.ts",
    "../../supabase/functions/mcp/resources/programPatchView.ts",
    "../../supabase/functions/mcp/resources/views/programPatch.generated.ts",
    "../../supabase/functions/mcp/tools/registry.ts",
    "../../supabase/functions/mcp/tools/updateProgram.ts",
    "../../supabase/functions/mcp/tools/applyProgramPatch.ts",
    "../../src/mcp-views/bridge.ts",
    "../../src/mcp-views/session-card/entry.tsx",
    "../../src/mcp-views/session-card/SessionCard.tsx",
    "../../src/mcp-views/session-card/render.tsx",
    "../../src/mcp-views/session-card/labels.ts",
    "../../src/mcp-views/session-card/example.ts",
    "../../src/mcp-views/program-patch/entry.tsx",
    "../../src/mcp-views/program-patch/ProgramPatchCard.tsx",
    "../../src/mcp-views/program-patch/render.tsx",
    "../../src/mcp-views/program-patch/labels.ts",
    "../../src/mcp-views/program-patch/example.ts",
    "../../scripts/build-mcp-view.mjs",
    "../../package.json",
  ],
  { query: "?raw", eager: true, import: "default" },
) as Record<string, string>

const viewSource = sources["../../supabase/functions/mcp/resources/programPatchView.ts"]
const viewArtifact = sources["../../supabase/functions/mcp/resources/views/programPatch.generated.ts"]
const resourcesRegistry = sources["../../supabase/functions/mcp/resources/registry.ts"]
const updateSource = sources["../../supabase/functions/mcp/tools/updateProgram.ts"]
const applySource = sources["../../supabase/functions/mcp/tools/applyProgramPatch.ts"]
const toolsRegistry = sources["../../supabase/functions/mcp/tools/registry.ts"]
const buildScript = sources["../../scripts/build-mcp-view.mjs"]
const packageJson = sources["../../package.json"]
const cardSource = sources["../mcp-views/program-patch/ProgramPatchCard.tsx"]

const viewFiles = Object.entries(sources).filter(([path]) => path.includes("mcp-views"))

describe("Decision Card MCP App View", () => {
  it("serves ui://gymlogic/program-patch as text/html;profile=mcp-app", () => {
    expect(viewSource).toMatch(/ui:\/\/gymlogic\/program-patch/)
    expect(viewSource).toMatch(/text\/html;profile=mcp-app/)
  })

  it("registers the view resource", () => {
    expect(resourcesRegistry).toMatch(/programPatchView/)
  })

  it("links update_program's dry run to the view", () => {
    expect(updateSource).toMatch(/resourceUri:\s*"ui:\/\/gymlogic\/program-patch"/)
  })

  it("keeps update_program's model-facing dry_run:false (no propose-only)", () => {
    expect(updateSource).toMatch(/dry_run/)
    expect(updateSource).toMatch(/applyProgramDiff/)
  })

  it("declares apply_program_patch as app-only", () => {
    expect(applySource).toMatch(/visibility:\s*\["app"\]/)
    expect(applySource).not.toMatch(/resourceUri/)
    expect(applySource).toMatch(/preview_token/)
    expect(applySource).toMatch(/dry_run:\s*false,\s*confirm:\s*payload\.confirm/)
    expect(toolsRegistry).toMatch(/applyProgramPatch/)
  })

  it("computes no write path directly from a view (host-mediated only)", () => {
    expect(viewFiles.length).toBeGreaterThan(0)
    for (const [path, source] of viewFiles) {
      expect(source, `${path} must not write directly`).not.toMatch(
        /\.insert\(|\.update\(|\.upsert\(|\.from\(|fetch\(/,
      )
    }
  })

  it("ships a committed, self-sufficient artifact", () => {
    expect(viewArtifact).toMatch(/export const PROGRAM_PATCH_HTML/)
    expect(viewArtifact).toMatch(/--nomos-color/)
  })

  it("guards every artifact against drift and builds both views", () => {
    expect(buildScript).toMatch(/--check/)
    expect(buildScript).toMatch(/SESSION_CARD_HTML/)
    expect(buildScript).toMatch(/PROGRAM_PATCH_HTML/)
    expect(packageJson).toMatch(/"view:check":/)
  })

  it("derives its CSS from the same named GL skin as the app (T304)", () => {
    expect(buildScript).toMatch(/glSkin\.generated\.css/)
    expect(buildScript).not.toMatch(/tokens\.generated\.css/)
  })

  it("carries the structured program + locale in structuredContent only (ADR 0031)", () => {
    expect(updateSource).toMatch(/buildPatchProgram/)
    expect(updateSource).toMatch(/program:\s*buildPatchProgram/)
    expect(viewFiles.length).toBeGreaterThan(0)
    expect(cardSource).toMatch(/payload\.program/)
  })

  it("renders with Nomos primitives and tones (ADR 0031)", () => {
    expect(cardSource).toMatch(/\bChip\b/)
    expect(cardSource).toMatch(/tone="danger"|tone="success"/)
    expect(cardSource).toMatch(/\bAlert\b/)
    expect(cardSource).toMatch(/\bKicker\b/)
  })
})
