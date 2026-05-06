/**
 * Tests for `getPublicMcpUrl` — the helper that decides which hostname to
 * stamp into the OAuth `resource:` field and the `WWW-Authenticate:
 * resource_metadata=...` URL.
 *
 * The two behaviors map exactly to the two deployment modes documented in
 * ADR 0001:
 *
 *   1. Request arrives via the Cloudflare Worker proxy → `X-Forwarded-Host`
 *      set → public URL must use the customer-facing hostname so the OAuth
 *      issuer in the metadata matches the one the client actually called.
 *
 *   2. Request hits Supabase directly (local Inspector, legacy clients on
 *      the old URL) → fall back to `SUPABASE_URL`. Both paths remain valid
 *      forever — old URL is never deprecated.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { getPublicMcpUrl } from "./publicUrl.ts"

Deno.test("getPublicMcpUrl: prefers X-Forwarded-Host when the Cloudflare proxy sets it", () => {
  const req = new Request("https://internal.supabase.co/functions/v1/mcp", {
    headers: { "X-Forwarded-Host": "mcp.gymlogic.me" },
  })
  assertEquals(
    getPublicMcpUrl(req, "https://internal.supabase.co"),
    "https://mcp.gymlogic.me/functions/v1/mcp",
  )
})

Deno.test("getPublicMcpUrl: falls back to SUPABASE_URL when X-Forwarded-Host is absent", () => {
  const req = new Request("https://abc.supabase.co/functions/v1/mcp")
  assertEquals(
    getPublicMcpUrl(req, "https://abc.supabase.co"),
    "https://abc.supabase.co/functions/v1/mcp",
  )
})
