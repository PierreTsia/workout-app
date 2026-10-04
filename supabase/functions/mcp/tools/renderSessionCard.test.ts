import { describe, expect, it } from "vitest"

import { renderSessionCard } from "./renderSessionCard.ts"

/**
 * The wire contract of the view link: an MCP Apps host finds the view through the
 * **reserved `_meta`** field on the tool definition. Shipping `meta` instead silently
 * disables rendering on every host (ADR 0027).
 */
describe("render_session_card tool contract", () => {
  it("references its MCP App view through _meta.ui.resourceUri", () => {
    expect(renderSessionCard._meta?.ui?.resourceUri).toBe("ui://gymlogic/session-card")
  })

  it("is read-only", () => {
    expect(renderSessionCard.annotations.readOnlyHint).toBe(true)
  })

  it("exposes the reserved `_meta` field, never `meta`", () => {
    expect(Object.keys(renderSessionCard)).toContain("_meta")
    expect(Object.keys(renderSessionCard)).not.toContain("meta")
  })
})
