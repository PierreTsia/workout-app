# T101 — Extract `getPublicMcpUrl` Helper to `lib/publicUrl.ts`

## Goal

Refactor the hardcoded `MCP_URL` constant in `supabase/functions/mcp/index.ts` into a per-request helper `getPublicMcpUrl(req, supabaseUrl)`, extracted into `file:supabase/functions/mcp/lib/publicUrl.ts` for testability. The helper reads `X-Forwarded-Host` (set by the upcoming Cloudflare Worker — see T102) to dynamically rewrite the `resource` field in `.well-known/oauth-protected-resource` and the `WWW-Authenticate` header on 401 responses, falling back to the Supabase URL for direct (non-Worker-routed) requests.

This is the **load-bearing primitive** of the MCP Public URL strategy. Without it, the function always advertises `*.supabase.co` regardless of which URL the user installed against — defeating the entire branding goal.

Addresses Epic Brief stories **2, 8, 9, 14**: brand domain matching, technical-user URL legitimacy, existing-user backward compat, future Supabase migration invisibility.

**Position in PR**: commit 2 of 5 on `feat/296/publish-mcp-connectors-directory`.

## Mode

**AFK** — function signature, fallback semantics, test cases, file location, and integration points are all pinned in the Tech Plan.

## Slice

`lib/publicUrl.ts (5 LOC pure helper)` → `lib/publicUrl_test.ts (2 cases)` → `index.ts (3 call sites updated)` → CI deno-unit (existing glob already covers `lib/*_test.ts`)

End-to-end demoable: `curl https://${SUPABASE_URL}/functions/v1/mcp/.well-known/oauth-protected-resource` returns `resource: ${SUPABASE_URL}/...`; same curl with `-H "X-Forwarded-Host: foo.example.com"` returns `resource: https://foo.example.com/functions/v1/mcp`.

## Dependencies

None technically (touches different files than T100). T100 lands first per the Tech Plan's commit ordering — if you re-shuffle, ensure `tsc` stays green between commits.

## Scope

### 1. New file — `supabase/functions/mcp/lib/publicUrl.ts`

```ts
/**
 * Per-request derivation of the public MCP URL.
 *
 * - Worker-routed: Cloudflare Worker stamps X-Forwarded-Host: mcp.gymlogic.me
 *   → returns "https://mcp.gymlogic.me/functions/v1/mcp"
 * - Direct Supabase URL: no X-Forwarded-Host
 *   → returns "${supabaseUrl}/functions/v1/mcp" (legacy URL existing users hit)
 *
 * See ADR 0001 for the dual-URL strategy and why OAuth metadata stays on Supabase.
 */
export function getPublicMcpUrl(req: Request, supabaseUrl: string): string {
  const forwardedHost = req.headers.get("X-Forwarded-Host")
  if (forwardedHost) {
    return `https://${forwardedHost}/functions/v1/mcp`
  }
  return `${supabaseUrl}/functions/v1/mcp`
}
```

**Pure function** — `supabaseUrl` passed as a parameter, NOT read from `Deno.env` inside. Tests don't need env-var setup; `index.ts` passes `Deno.env.get("SUPABASE_URL")!` at the call site.

### 2. New file — `supabase/functions/mcp/lib/publicUrl_test.ts`

Deno test, ~15 LOC. Two cases:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { getPublicMcpUrl } from "./publicUrl.ts"

const FAKE_SUPABASE = "https://favusepjqwpcroiolvaz.supabase.co"

Deno.test("getPublicMcpUrl: returns brand URL when X-Forwarded-Host is present", () => {
  const req = new Request("https://example.com/", {
    headers: { "X-Forwarded-Host": "mcp.gymlogic.me" },
  })
  assertEquals(getPublicMcpUrl(req, FAKE_SUPABASE), "https://mcp.gymlogic.me/functions/v1/mcp")
})

Deno.test("getPublicMcpUrl: falls back to supabase URL when X-Forwarded-Host is absent", () => {
  const req = new Request("https://example.com/")
  assertEquals(getPublicMcpUrl(req, FAKE_SUPABASE), `${FAKE_SUPABASE}/functions/v1/mcp`)
})
```

Match the existing Deno test convention (`*_test.ts`, `Deno.test(...)` blocks). Std-lib import version follows the existing pattern in `lib/*_test.ts` files (use whatever version they use today; align rather than introduce drift).

### 3. Modify `file:supabase/functions/mcp/index.ts`

Three integration points (currently using a hardcoded `MCP_URL` constant):

| Site | Current code | After |
|---|---|---|
| `RESOURCE_METADATA_URL` (used in `WWW-Authenticate` header) | Module-load constant referencing `MCP_URL` | Per-request: `${getPublicMcpUrl(req, SUPABASE_URL)}/.well-known/oauth-protected-resource` (move into the request handler) |
| `WWW-Authenticate` header on 401 responses | Module-load constant string | Per-request constant computed from `getPublicMcpUrl(req, SUPABASE_URL)` |
| `.well-known/oauth-protected-resource` `resource` field | Hardcoded `MCP_URL` | `getPublicMcpUrl(req, SUPABASE_URL)` |

**Net diff:** ~5 LOC removed (old hardcoded constants), ~3 LOC added (import + 3 call sites).

Add the import at the top of `index.ts`:

```ts
import { getPublicMcpUrl } from "./lib/publicUrl.ts"
```

The `SUPABASE_URL` env var is already read in `index.ts` (`Deno.env.get("SUPABASE_URL")!`); reuse it.

### 4. Verify locally

```bash
deno test "supabase/functions/mcp/lib/*_test.ts" --allow-env
```

Should pass: includes the new `publicUrl_test.ts` plus all existing `lib/*_test.ts` files.

Manual smoke (against local Supabase):

```bash
# No X-Forwarded-Host → fallback path
curl -s "http://127.0.0.1:54321/functions/v1/mcp/.well-known/oauth-protected-resource" | jq '.resource'
# Expected: "http://127.0.0.1:54321/functions/v1/mcp"

# With X-Forwarded-Host → branded path
curl -s -H "X-Forwarded-Host: mcp.gymlogic.me" \
  "http://127.0.0.1:54321/functions/v1/mcp/.well-known/oauth-protected-resource" | jq '.resource'
# Expected: "https://mcp.gymlogic.me/functions/v1/mcp"
```

## Out of Scope

- The Cloudflare Worker that actually stamps the header (T102).
- Worker deployment + custom-domain TLS (T105).
- `.well-known/oauth-authorization-server` proxy logic — stays as-is per ADR 0001 Option A; the function continues to point Claude at `*.supabase.co/auth/v1` for the OAuth issuer.
- Modifying `WWW-Authenticate` header **format** (only the URL inside changes, not the auth scheme).

## Acceptance Criteria

- [ ] `lib/publicUrl.ts` exists with the `getPublicMcpUrl(req, supabaseUrl)` exported function.
- [ ] `lib/publicUrl_test.ts` exists with 2 test cases (with / without `X-Forwarded-Host`).
- [ ] `index.ts` imports the helper and uses it in all 3 integration sites; the old hardcoded `MCP_URL` constant is gone.
- [ ] Local `deno test "supabase/functions/mcp/lib/*_test.ts" --allow-env` passes (and runs in CI on push, via the existing glob).
- [ ] Local `tsc --noEmit` (or `deno check`) passes.
- [ ] Manual smoke: both paths (with / without `X-Forwarded-Host`) return the expected `.resource` field via curl.
- [ ] Demoable: end-to-end against `127.0.0.1:54321` showing the resource field swap based on the header.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track A2.2)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Key Decisions: function-side change, getPublicMcpUrl test coverage; Data Model section 4; Component Responsibilities; Implementation Notes commit 2)
- ADR: `file:docs/adr/0001-mcp-public-url-and-oauth-issuer.md`
- Glossary: `file:docs/CONTEXT.md` (MCP Public URL, MCP Edge Function URL)
- Code anchors: `file:supabase/functions/mcp/index.ts`, `file:supabase/functions/mcp/lib/auth.ts` (existing lib/ pattern)
