# T115 — Phase A Safety Rails + Verification Runbook

## Goal

Make Phase A hard to misuse and easy to verify repeatedly: add guardrails against accidental privileged calls, and document a repeatable smoke path for the Phase A proof endpoint.

Addresses Epic Brief stories: **#20**.

## Mode

**AFK** — mechanical hardening + documentation.

## Slice

`edge guardrails → dev runbook/script → (optional CI hook) → demoable verification`

## Dependencies

- `T113 — MCP JSON-RPC Client Helper`
- `T114 — Phase A MCP create_program Dry-Run Proof Endpoint`

## Scope

### Safety rails

- In the Phase A proof edge function, add explicit checks that prevent:
  - Missing/invalid user identity (must pass `supabase.auth.getUser()`).
  - Any attempt to call MCP without a user access token.
- Add structured logging fields for failures:
  - `feature=mcp-phase-a-proof`, `error_kind`, `user_id` (when available), and request id.

### Verification runbook

- Add a short doc snippet in the ticket (or a minimal script under `scripts/`) describing:
  - How to obtain a user access token (dev instructions)
  - How to call the Phase A proof endpoint
  - What a successful response looks like (preview payload)
  - Common failure modes (401, validation error)

*(If adding a script, keep it simple: a `curl` command is fine. Avoid introducing new deps.)*

## Out of Scope

- No production rollout / cutover to Phase B.
- No changes to MCP server implementation.

## Acceptance Criteria

- [ ] Phase A proof endpoint emits structured logs for common failures (auth missing, MCP error).
- [ ] A documented “copy/paste” verification path exists and works for a maintainer.
- [ ] Guardrails ensure the endpoint cannot be used to persist programs.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md`
- Tech Plan (Phase A): `file:docs/Tech_Plan_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295_Phase_A.md`
- Proof endpoint: `file:supabase/functions/mcp-phase-a-proof/index.ts` (to be created in T114)
