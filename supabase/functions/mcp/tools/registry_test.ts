/**
 * Property tests for the tool registry — guards two invariants that survive
 * future refactors of `list()` or annotation matrix edits:
 *
 *   1. Every registered tool exposes `annotations.title` (the user-visible
 *      label MCP clients render). TS already enforces the type shape; this
 *      catches the runtime regression where `list()` is refactored to strip
 *      more fields than `handler`.
 *
 *   2. No tool claims both `readOnlyHint` AND `destructiveHint` — those
 *      hints are mutually exclusive in MCP semantics. Catches the
 *      copy-paste bug TS can't see.
 *
 * See `file:docs/adr/0001-mcp-public-url-and-oauth-issuer.md` and T100 for
 * the full matrix.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { toolRegistry } from "./registry.ts"

Deno.test("every tool exposes annotations.title via list()", () => {
  for (const tool of toolRegistry.list()) {
    const hasTitle =
      typeof tool.annotations?.title === "string" && tool.annotations.title.length > 0
    assertEquals(hasTitle, true, `${tool.name} has missing or empty annotations.title`)
  }
})

Deno.test("no tool claims both readOnlyHint and destructiveHint", () => {
  for (const tool of toolRegistry.list()) {
    const a = tool.annotations
    const conflicts = Boolean(a?.readOnlyHint && a?.destructiveHint)
    assertEquals(
      conflicts,
      false,
      `${tool.name} cannot be both readOnly and destructive — pick one`,
    )
  }
})
