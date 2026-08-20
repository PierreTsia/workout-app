# ADR 0001 — MCP public URL and OAuth issuer

- **Status:** Accepted
- **Date:** 2026-05-06
- **Decided in:** grilling session on branch `feat/296/publish-mcp-connectors-directory`

## Context

GymLogic exposes an MCP server today at the Supabase-generated URL `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp` (see **MCP Edge Function URL** in `docs/CONTEXT.md`). Issue #296 needs to submit this server to the Anthropic Connectors Directory; one of the documented [review criteria](https://claude.com/docs/connectors/building/review-criteria) is *"the MCP server domain should match your service"*.

Forces at play:

- **Trust**: a Supabase-generated hostname looks phishy to non-technical users; `mcp.gymlogic.me` reads as legitimate.
- **Portability**: if we ever migrate off Supabase, users installed against `*.supabase.co` would all need to re-install. A branded URL hides that future risk.
- **OAuth coupling**: the function exposes `.well-known/oauth-protected-resource` (RFC 9728) and proxies `.well-known/oauth-authorization-server` (RFC 8414) from Supabase Auth. The OAuth `authorization_endpoint`, `token_endpoint`, and dynamic-registration endpoint all live at `*.supabase.co/auth/v1/*`. The user-facing OAuth consent screen already runs on `gymlogic.me/oauth/consent`.
- **Existing users**: a tiny number (currently the maintainer himself, plus any beta testers) are installed against the Supabase URL.
- **Operational risk**: this is the public-facing edge of the MCP service. Bad deploys can't be rolled back via DNS quickly.

## Decision

We will route the MCP server under **`https://mcp.gymlogic.me/functions/v1/mcp`** via a Cloudflare Worker proxy, while keeping OAuth on Supabase Auth.

Specifically:

1. **Cloudflare Worker** fronts `mcp.gymlogic.me`, source code in `infra/cloudflare/mcp-proxy/`. The Worker is a near-pure passthrough — it forwards every request to the **MCP Edge Function URL**, adding only `X-Forwarded-Host` so the function knows the public host. The Worker also: (a) supports a `KILL_SWITCH` env var that, when set to `"true"`, returns `503 Service Unavailable` for **POST** requests only (kills MCP RPC; lets `.well-known/*` GETs through so OAuth metadata stays accessible during incident triage), (b) emits a one-line `console.log` per request for ops visibility.
2. **OAuth stays on Supabase**. The `.well-known/oauth-authorization-server` response continues to point at `*.supabase.co/auth/v1`. Claude users see `supabase.co` for ~200ms during the OAuth redirect chain; the URL they paste/install with is fully `mcp.gymlogic.me`.
3. **The function dynamically rewrites the `resource` field** in `.well-known/oauth-protected-resource` and the `WWW-Authenticate` header, by reading `X-Forwarded-Host` (with fallback to `SUPABASE_URL`-derived). This is the only function-side code change required.
4. **Both URLs stay alive forever**. The Supabase URL is not blocked, deprecated, or sunset; it stays as a silent compatibility path. Only `mcp.gymlogic.me` is promoted in user-facing docs (`skills/gymlogic-mcp/SKILL.md`, `docs/mcp-connect/*.md`, the eventual #302 MDX page, the Anthropic submission form).

## Consequences

**Positive**

- Users see a branded URL that matches the rest of the GymLogic surface; trust on install increases.
- If we migrate off Supabase later, the Worker config changes; user installs don't.
- Kill switch gives us an incident-response lever that doesn't require a function redeploy.
- Existing users (Supabase URL) keep working with zero migration anxiety.
- Per-request `getPublicMcpUrl(req)` derivation is the single load-bearing primitive — cleanly testable.

**Negative**

- Two surfaces to maintain: the Worker config and the function code. Coupling is documented (this ADR + `docs/CONTEXT.md`).
- "Matching domain" is **partial** — the MCP endpoint is on `mcp.gymlogic.me`, but the OAuth issuer is `supabase.co`. If Anthropic reviewers reject the submission on this basis, the follow-up is to also proxy `mcp.gymlogic.me/.well-known/oauth-authorization-server` and `mcp.gymlogic.me/auth/*` (Worker scope expands; function less affected). Not pre-built — premature.
- Cloudflare Workers free tier limits apply (100k requests/day); fine for current MCP traffic but worth monitoring if usage spikes.
- A Cloudflare Worker outage now sits on the critical path. Mitigated by the Supabase URL still being live as a fallback (existing installs unaffected; new installs blocked until Worker recovers).

**Follow-ups**

- Update `skills/gymlogic-mcp/SKILL.md`: URL on line 57, plus the `nine` vs `Ten` tool count inconsistency between line 13 and line 66 — same PR.
- Update every `docs/mcp-connect/*.md` to reference `mcp.gymlogic.me` — same PR.
- Tech Plan #302's MDX example (line 525 of `file:docs/done/Tech_Plan_—_A4_Connect_Claude_#302.md`) hardcodes the Supabase URL; #302's implementer should pick up the new URL on rebase. Tag in the #302 implementation kickoff.
- ADR sequel if Anthropic rejects on issuer-domain grounds: extend Worker scope to also proxy OAuth metadata + endpoints.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Custom Domain natively on Supabase | Paid Pro add-on (~$10/mo), Supabase lock-in, no kill switch |
| `CNAME mcp.gymlogic.me → *.supabase.co` directly | TLS handshake breaks (Supabase cert is on `*.supabase.co`, not `gymlogic.me`) |
| Full OAuth proxy via Worker | Re-implements OAuth metadata + endpoints rewriting for ~200ms of UX gain; high failure-mode surface (PKCE relay, refresh token rotation, dynamic-client-registration redirect URIs from Claude). Premature given Anthropic's literal "MCP server domain" criterion is satisfied by the chosen option |
| Replace Supabase Auth with a custom OAuth AS | Massive scope creep, kills timeline |
| Smart Worker that rewrites `.well-known` body inline | Splits business logic across Worker + function; "where does this live?" confusion when debugging |
| Hard cutover — block direct Supabase URL access | Hostile to existing users; breaks `wrangler dev` local testing |
| Soft sunset with `Sunset` header | Most MCP clients don't surface response headers — deprecation invisible until the day it bites |
| Worker source in separate `PierreTsia/mcp-proxy` repo | Cross-repo coordination overhead; Worker ↔ function contract better colocated |
| Canary subdomain `mcp-canary.gymlogic.me` for staging | Premature at current user count (= maintainer); kill switch + fast rollback already give the same safety |
