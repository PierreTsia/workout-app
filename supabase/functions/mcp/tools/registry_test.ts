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

/**
 * MCP Apps metadata (ADR 0027/0028) must survive `list()`, which strips only `handler`.
 * A dropped `_meta` disables the view on every host; it is a public contract, so it is
 * pinned here (Deno — the SPA tsconfig cannot import the Deno-targeted graph).
 */
Deno.test("list() carries the MCP Apps _meta links", () => {
  const tools = toolRegistry.list()
  const byName = (name: string) => tools.find((t) => t.name === name)

  assertEquals(
    byName("update_program")?._meta?.ui?.resourceUri,
    "ui://gymlogic/program-patch",
  )
  assertEquals(
    byName("render_session_card")?._meta?.ui?.resourceUri,
    "ui://gymlogic/session-card",
  )

  const apply = byName("apply_program_patch")
  assertEquals(apply?._meta?.ui?.visibility, ["app"])
  assertEquals(apply?._meta?.ui?.resourceUri, undefined)

  for (const tool of tools) {
    assertEquals(
      Object.keys(tool).includes("handler"),
      false,
      `${tool.name} leaks its handler into the wire schema`,
    )
  }
})
