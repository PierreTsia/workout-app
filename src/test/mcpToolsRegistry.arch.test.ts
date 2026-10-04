import { describe, expect, it } from "vitest"

import { toolRegistry } from "../../supabase/functions/mcp/tools/registry"

/**
 * `tools/list` is a **public MCP contract** (AGENTS.md): the `_meta` a host reads to render a
 * view or hide an app-only tool must survive the registry's list mapping, not just exist on
 * the tool object. This drives the real registry, so a dropped `_meta` fails here.
 */
describe("MCP tools registry — MCP Apps metadata", () => {
  const tools = toolRegistry.list()
  const byName = (name: string) => tools.find((t) => t.name === name)

  it("links update_program's dry run to the Decision Card view", () => {
    expect(byName("update_program")?._meta?.ui?.resourceUri).toBe("ui://gymlogic/program-patch")
  })

  it("links render_session_card to the Session Card view", () => {
    expect(byName("render_session_card")?._meta?.ui?.resourceUri).toBe(
      "ui://gymlogic/session-card",
    )
  })

  it("marks apply_program_patch app-only, with no view", () => {
    const apply = byName("apply_program_patch")
    expect(apply?._meta?.ui?.visibility).toEqual(["app"])
    expect(apply?._meta?.ui?.resourceUri).toBeUndefined()
  })

  it("never leaks the handler into the wire schema", () => {
    for (const tool of tools) {
      expect(Object.keys(tool)).not.toContain("handler")
    }
  })
})