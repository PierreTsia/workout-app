# T113 — MCP JSON-RPC Client Helper

## Goal

Create a reusable **server-side** helper to call the GymLogic **MCP** server via JSON-RPC `tools/call` with a user Bearer token, returning a normalized success/error shape. This is the foundation primitive for Phase A of Epic **#295** (and will be reused by Phase B).

Addresses Epic Brief stories: **#20**.

## Mode

**AFK** — mechanical, no product decisions.

## Slice

`shared module → (unit tests) → used by later Edge endpoints`

## Dependencies

None.

## Scope

### Implementation

- Add `file:supabase/functions/_shared/mcpClient.ts`:
  - Function to call MCP `tools/call`:
    - Inputs: `toolName`, `arguments`, `userAccessToken`, `mcpUrl`
    - HTTP: `POST` to MCP, header `Authorization: Bearer <token>`, JSON body:
      - `{"jsonrpc":"2.0","id":<number>,"method":"tools/call","params":{"name":..., "arguments":...}}`
  - Parse responses:
    - JSON-RPC top-level error → normalize to `{ ok:false, kind:"rpc_error", ... }`
    - Tool returns `{ isError: true }` → normalize to `{ ok:false, kind:"tool_error", ... }`
    - Success → `{ ok:true, value }`
  - Never throw for expected failures; return structured errors for logs/UX layers.

### Tests

- Add `file:supabase/functions/_shared/mcpClient_test.ts` (Deno test):
  - Verify request envelope shape (method, params, headers) using a mocked `fetch`.
  - Verify parsing for:
    - JSON-RPC error
    - tool `isError`
    - success result

## Out of Scope

- No new Edge Function endpoint (that’s T114).
- No persistence calls (no `create_program` calls yet).

## Acceptance Criteria

- [ ] `mcpClient` can call MCP `tools/call` with Bearer token and returns `{ ok:true }` on success.
- [ ] `mcpClient` returns structured `{ ok:false }` for JSON-RPC errors and tool-level errors (no thrown exceptions for expected errors).
- [ ] Unit tests cover success + rpc error + tool error cases.
- [ ] No app/frontend code changes.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md`
- Tech Plan (Phase A): `file:docs/Tech_Plan_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295_Phase_A.md`
- MCP entrypoint: `file:supabase/functions/mcp/index.ts`
