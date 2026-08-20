# T114 — Phase A MCP `create_program` Dry-Run Proof Endpoint

## Goal

Add a minimal **Phase A proof** Edge Function endpoint that demonstrates: server-side code can call MCP `create_program` with a **user JWT**, and receive a `dry_run:true` preview payload. No persistence is allowed in this ticket.

Addresses Epic Brief stories: **#20**.

## Mode

**AFK** — decisions already locked (location + auth + dry_run-only).

## Slice

`edge function → mcpClient → MCP tools/call → (integration test) → demoable endpoint`

## Dependencies

`T113 — MCP JSON-RPC Client Helper`

## Scope

### Edge Function

- Create `file:supabase/functions/mcp-phase-a-proof/index.ts`
  - Route: single handler (POST) that:
    - Authenticates user via `supabase.auth.getUser()` (no decode-only identity).
    - Accepts a minimal request body with a **small** sample program definition (or reuses a hardcoded minimal payload).
    - Calls MCP `create_program` via `mcpClient` with **`dry_run:true` enforced server-side**.
    - Returns MCP response payload (preview) as JSON.
  - Hard rule: if request attempts `dry_run:false`, reject with 400.
  - Hard rule: do not write any program rows directly; all interaction is via MCP dry-run.

### Integration test (recommended)

- Add a Deno test that runs locally against a local/staging MCP URL with a real user token if available, OR at minimum a mocked fetch test that proves the endpoint calls MCP with the correct envelope and rejects persist attempts.

## Out of Scope

- No `dry_run:false` support anywhere (Phase A proof is preview-only).
- No onboarding UI changes.
- No feature flag wiring (Phase B owns the cutover flag).

## Acceptance Criteria

- [ ] With a valid user Bearer token, calling the proof endpoint returns a JSON payload from MCP `create_program` `dry_run:true`.
- [ ] The endpoint rejects any attempt to persist (`dry_run:false`) with a clear error.
- [ ] The endpoint uses `mcpClient` (no duplicated JSON-RPC wiring).
- [ ] At least one automated test covers: (a) auth required, (b) persist attempt rejected, (c) MCP call is issued.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md`
- Tech Plan (Phase A): `file:docs/Tech_Plan_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295_Phase_A.md`
- MCP tool: `file:supabase/functions/mcp/tools/createProgram.ts`
