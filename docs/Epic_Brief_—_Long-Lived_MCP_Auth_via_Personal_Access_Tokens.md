# Epic Brief — Long-Lived MCP Auth via Personal Access Tokens

## Summary

Add GitHub-style **Personal Access Tokens (PATs)** as a long-lived auth path for MCP clients, alongside the existing OAuth 2.1 + PKCE flow. A user mints a `glp_…` token from a new settings page, pastes it as a static `Bearer` in their MCP client config (Claude Desktop, Cursor, Le Chat, headless agents), and stops fighting the 1-hour Supabase JWT expiry. OAuth keeps existing for browser-resident apps; PAT serves every other case. Closes one of the open Risks rows of Epic #231 (MCP-First Architecture) and unblocks headless-agent integrations like sudo-ceo/Iris.

---

## Context & Problem

**Who is affected:** Any user of an MCP client that doesn't reliably implement Supabase's refresh-token rotation (Claude Desktop, Le Chat, Cursor) — and any user trying to run a headless agent (no browser available).

**Current state:**

- The MCP Edge Function (`file:supabase/functions/mcp/index.ts`) accepts only `Authorization: Bearer <jwt>`.
- The only documented way to obtain that JWT is OAuth 2.1 + PKCE with browser consent at `gymlogic.me/oauth/consent`.
- Supabase JWT TTL = **1 hour** (`jwt_expiry = 3600` in `file:supabase/config.toml`). Refresh token rotation is enabled but client-implementation-dependent — most MCP clients don't persist refresh tokens across restarts.
- Cursor docs (`file:docs/mcp-connect/cursor.md`) explicitly tell users to copy the access JWT from `localStorage` and paste it as a static header — acknowledged in-doc as a 1-hour workaround.
- No path at all for a headless client (VPS agent without a browser).

**Pain points:**

| Pain | Impact |
|---|---|
| Claude Desktop loses MCP auth ~hourly, requires full OAuth dance to reconnect | User reconnects multiple times per week — death by a thousand papercuts |
| Cursor MCP setup tells users to paste a 1h JWT from `localStorage` | Manual rotation; broken overnight; documented workaround, not a real path |
| No headless auth path exists | Any agent on a VPS or CI cannot integrate; Epic #231 listed this as an open Risk |
| External agent ecosystem (e.g. sudo-ceo/Iris) is building "refresh-token broker daemons" to work around it | We're externalizing the cost of a missing primitive instead of fixing it once at the source |

---

## Goals

| Goal | Measure |
|---|---|
| Eliminate the hourly reconnect cycle for MCP clients | A PAT pasted as a Bearer keeps a Claude Desktop / Cursor / curl integration working for ≥ 90 days with zero user action |
| Unblock headless-agent integrations | A VPS-hosted agent can authenticate to MCP without ever opening a browser after initial PAT provisioning |
| Keep OAuth path intact for browser-resident apps | Zero behavioral change for users who use the existing in-app login or the OAuth + PKCE flow |
| Provide revocation as the primary security mechanism | User can revoke a PAT from `/settings/api-tokens`; next request returns 401 within one request cycle |

---

## Scope

### In scope

1. **Token model + schema** — new `personal_access_tokens` table (`id, user_id, name, token_hash, prefix, last_used_at, expires_at nullable, revoked_at nullable, created_at`), plus server-side helpers for mint / verify / revoke. RLS on the table itself: a user can only read/revoke their own rows.
2. **MCP Edge Function auth path** — in `file:supabase/functions/mcp/index.ts`: detect `glp_` prefix, hash and look up in `personal_access_tokens`, resolve to `user_id`, mint a user-scoped Supabase client. Fall through to existing JWT validation if not a PAT. Update `last_used_at` (debounced, ≤ 1 write/min/PAT to avoid hot-row contention). **PAT auth applies to `mcp/index.ts` only in v0** — other Bearer-protected Edge Functions (`generate-workout`, `send-transactional-email`, …) stay OAuth-only.
3. **Settings UI** — new dedicated page `/settings/api-tokens`: list existing tokens (name, created, last used, expires), create flow with one-time plaintext display + clear "you will never see this again" copy, revoke action. Creation is allowed only from a browser-authenticated session (Supabase JWT) — never from a PAT-authenticated request, to prevent escalation.
4. **Lifetimes** — user picks `30 / 90 / 365 / never`. Default = 90 days. The `never` option is allowed but the UI surfaces a warning ("non-expiring tokens are harder to audit; revisit every 6 months").
5. **Single scope in v0** — every PAT inherits the full account scope (matches OAuth flow's current behavior). No new authorization model to reason about.
6. **Documentation refresh** — kept in scope of this epic, not punted to a follow-up:
   - **New** `docs/mcp-connect/api-tokens.md` — how to mint, set lifetime, paste in any MCP client; security warnings (one-time display, revocation flow).
   - **New** `docs/mcp-connect/headless.md` — VPS / CI / agent recipe (PAT in env var, no browser).
   - **Rewrite** `file:docs/mcp-connect/cursor.md` — the entire "Get your access token" section (which today walks the user through copying the JWT from `localStorage`) is **removed**, replaced with the PAT-mint flow. PAT becomes the only documented Cursor path.
   - **Update** `file:docs/mcp-connect/claude-desktop.md` and `file:docs/mcp-connect/le-chat.md` — add a "Tired of reconnecting?" section pointing to the PAT path; OAuth flow stays as the default for browser-resident first-time setup.
   - **Update** `file:docs/Epic_Brief_—_MCP-First_Architecture_#231.md` — mark the "fallback to Bearer token auth for personal use" Risks row as closed, with a back-reference to this epic.
   - **Update** `file:docs/Tech_Plan_—_MCP-First_Architecture_#231.md` — short note in the Auth decisions section that PATs are now the recommended path for non-browser clients (link to this epic + the new `api-tokens.md`).

### Out of scope

- **Device flow (RFC 8628)** — option B in the source issue. Defer until a concrete client benefits.
- **PAT auth on Edge Functions other than `mcp/`** (e.g. `generate-workout`, `send-transactional-email`). Wider surface, no current user pain. Revisit if the need surfaces.
- **Fine-grained scopes** (`workouts:read`, `programs:write`, etc.). v0 ships a single full-account scope; v1 adds granularity once we know which clients need what.
- **Per-PAT rate limiting** — accepted risk: a leaked PAT can be abused at full request rate until manually revoked. Mitigated by revocation + `last_used_at` visibility. Revisit in v1 if abuse is observed.
- **IP allowlisting on PATs** — second iteration.
- **Rich audit log** (IP, user-agent per call). v0 = `last_used_at` only.
- **Org / team accounts**, auto-rotation on anomaly, replacing OAuth — none of these in scope.

---

## Success Criteria

- **Numeric:** A PAT minted with the default lifetime (90 days) authenticates an MCP client for **≥ 90 consecutive days** with zero user re-auth, zero browser dance.
- **Numeric:** Revocation is effective within **one request cycle** — the next PAT-authenticated MCP call after `revoked_at` is set returns 401.
- **Qualitative:** Pasting a PAT as a Bearer in Claude Desktop / Cursor / Le Chat / curl Just Works, with no client-side change required.
- **Qualitative:** Headless agents (e.g. sudo-ceo/Iris) can drop their refresh-token-broker workaround and ship a static Bearer config instead.
- **Qualitative:** Browser-flow users see zero behavioral change — existing in-app login and OAuth + PKCE flow are untouched.
- **Qualitative:** All three `docs/mcp-connect/*.md` files reflect the PAT path; `cursor.md` no longer instructs users to copy a JWT from `localStorage`; the Risks row in Epic Brief #231 is explicitly marked closed with a back-reference to this epic.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **RLS strategy unclear** — how do we mint a user-scoped Supabase client from a PAT? Three candidates (service_role + manual filter, mint a Supabase JWT signed with `JWT_SECRET`, admin API impersonation), each with different security posture. | Spike this in the Tech Plan **before** any other workstream. The chosen mechanism gates everything else. |
| **Hashing choice** — bcrypt is unworkable on a hot auth path (10-100ms/call); PATs are high-entropy random secrets, not low-entropy passwords. | Tech Plan defaults to **HMAC-SHA-256 with a server-side pepper** (constant-time, no per-request bcrypt cost). Document the rationale. |
| **Leaked PAT = full account compromise until revoked** | Default 90-day expiry, revocation UI, `last_used_at` visibility. Per-PAT rate-limit deferred to v1 — accepted risk. |
| **`never`-lifetime tokens become zombies** | Allowed in v0 per product call, but the UI must warn ("non-expiring tokens are harder to audit"). Revisit in v1 if abuse data shows up. |
| **PAT escalation** — using a PAT to mint another PAT would let a leak bootstrap permanence | The `/settings/api-tokens` create endpoint accepts only browser-session auth (Supabase JWT), never a PAT-authenticated request. |
| **Hot-row contention on `last_used_at`** | Debounce updates to ≤ 1/min/PAT. |

---

## References

- GitHub issue: [#259](https://github.com/PierreTsia/workout-app/issues/259)
- Epic #231 — MCP-First Architecture (this epic closes one of its open Risks rows)
- T64 — OAuth 2.1 + Consent Page (`file:docs/done/T64_—_OAuth_2.1_+_Consent_Page.md`)
- `file:docs/mcp-connect/cursor.md` — the "paste token" doc this epic replaces
- `file:docs/mcp-connect/claude-desktop.md` / `file:docs/mcp-connect/le-chat.md` — get a PAT callout added
- `file:docs/Epic_Brief_—_MCP-First_Architecture_#231.md` — Risks row to close
- `file:docs/Tech_Plan_—_MCP-First_Architecture_#231.md` — Auth decisions to annotate
- `file:supabase/config.toml` — `[auth.oauth_server]` config
- `file:supabase/functions/mcp/index.ts` — where the PAT-prefix branch lands
- `file:supabase/functions/mcp/lib/supabaseClient.ts` — current `createUserClient` factory; will need a sibling or a unified factory
