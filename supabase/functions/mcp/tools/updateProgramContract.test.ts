import { describe, expect, it } from "vitest"

import { updateProgram } from "./updateProgram"

/**
 * The `update_program` MCP Apps + consent contract (ADR 0028): the dry run links the
 * Decision Card view, and `dry_run:false` is **kept** so non-MCP-Apps hosts
 * (Cursor / Le Chat / Iris) do not lose program editing.
 */
describe("update_program contract", () => {
  it("references the Decision Card view", () => {
    expect(updateProgram._meta?.ui?.resourceUri).toBe("ui://gymlogic/program-patch")
  })

  it("keeps dry_run (no propose-only in v1)", () => {
    expect(Object.keys(updateProgram.inputSchema.properties)).toContain("dry_run")
    expect(updateProgram.description).toMatch(/dry_run: false/)
  })

  it("stays destructive — it can still write via dry_run:false", () => {
    expect(updateProgram.annotations.destructiveHint).toBe(true)
  })
})
