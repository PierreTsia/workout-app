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


| Pain                                                                                                       | Impact                                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Claude Desktop loses MCP auth ~hourly, requires full OAuth dance to reconnect                              | User reconnects multiple times per week — death by a thousand papercuts                     |
| Cursor MCP setup tells users to paste a 1h JWT from `localStorage`                                         | Manual rotation; broken overnight; documented workaround, not a real path                   |
| No headless auth path exists                                                                               | Any agent on a VPS or CI cannot integrate; Epic #231 listed this as an open Risk            |
| External agent ecosystem (e.g. sudo-ceo/Iris) is building "refresh-token broker daemons" to work around it | We're externalizing the cost of a missing primitive instead of fixing it once at the source |


---

## Goals


| Goal                                                 | Measure                                                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Eliminate the hourly reconnect cycle for MCP clients | A PAT pasted as a Bearer keeps a Claude Desktop / Cursor / curl integration working for ≥ 90 days with zero user action |
| Unblock headless-agent integrations                  | A VPS-hosted agent can authenticate to MCP without ever opening a browser after initial PAT provisioning                |
| Keep OAuth path intact for browser-resident apps     | Zero behavioral change for users who use the existing in-app login or the OAuth + PKCE flow                             |
| Provide revocation as the primary security mechanism | User can revoke a PAT from `/settings/api-tokens`; next request returns 401 within one request cycle                    |


---

## Scope

### In scope

1. **Token model + schema** — new `personal_access_tokens` table (`id, user_id, name NOT NULL, token_hash, prefix, last_used_at, expires_at nullable, created_at`), plus server-side helpers for mint / verify / revoke. **Revocation = hard delete** (row removed) — no `revoked_at` column, no soft-delete footgun (`WHERE revoked_at IS NULL` filters that someone forgets to add). RLS on the table itself: a user can only read/delete their own rows. **Constraints**: max 10 active PATs per user (cap, easy to relax later), `name` is mandatory (so the list stays readable as "Cursor laptop" / "Claude desktop work" / "Iris VPS").
2. **MCP Edge Function auth path** — in `file:supabase/functions/mcp/index.ts`: detect `glp_` prefix, hash and look up in `personal_access_tokens`, resolve to `user_id`, mint a user-scoped Supabase client. Fall through to existing JWT validation if not a PAT. Update `last_used_at` only when the stored value is older than 1 minute (stateless write-if-stale, no in-memory debounce, no cold-start state loss). **PAT auth applies to `mcp/index.ts` only in v0** — other Bearer-protected Edge Functions (`generate-workout`, `send-transactional-email`, …) stay OAuth-only.
3. **Settings UI** — new dedicated page `/settings/api-tokens`: list existing tokens (name, created, last used, expires), create flow with one-time plaintext display + clear "you will never see this again" copy, revoke action (hard delete with explicit confirmation). Creation is allowed only from a browser-authenticated session (Supabase JWT) — never from a PAT-authenticated request, to prevent escalation. **No regeneration in v0** — revoke + recreate; same-name reuse is fine.
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
- **Rich audit log** (IP, user-agent per call) — v0 = `last_used_at` only.
- **PAT history / revoked-token log** — hard delete in v0; a separate `token_audit` table is v1 territory if a real need surfaces.
- **PAT regeneration** (mint a new secret while keeping the same row / name) — not in v0; revoke + recreate.
- **Org / team accounts**, auto-rotation on anomaly, replacing OAuth — none of these in scope.

---

## Migration & Backwards Compatibility

**No migration required.** PATs are purely additive. Existing OAuth 2.1 + PKCE sessions remain valid until their natural expiry (1h JWT + refresh token rotation as today). The two auth paths coexist indefinitely:

- Users who use the in-app Google login or the OAuth consent flow see zero change.
- Users who paste an OAuth access token in their MCP client config (the Cursor `localStorage` workaround) keep working until that token expires — at which point the updated `cursor.md` doc steers them to the PAT path instead of telling them to grab another 1h JWT.
- No DB migration of existing user rows; the new `personal_access_tokens` table is empty on day one and only populates as users explicitly mint tokens.
- Once a user has minted a PAT, **both** auth paths remain available to them — there is no "you must choose one" lock-in.

---

## Success Criteria

- **Numeric:** A PAT minted with the default lifetime (90 days) authenticates an MCP client for **≥ 90 consecutive days** with zero user re-auth, zero browser dance.
- **Numeric:** Revocation is effective within **one request cycle** — the next PAT-authenticated MCP call after the row is deleted returns 401.
- **Qualitative:** Pasting a PAT as a Bearer in Claude Desktop / Cursor / Le Chat / curl Just Works, with no client-side change required.
- **Qualitative:** Headless agents (e.g. sudo-ceo/Iris) can drop their refresh-token-broker workaround and ship a static Bearer config instead.
- **Qualitative:** Browser-flow users see zero behavioral change — existing in-app login and OAuth + PKCE flow are untouched.
- **Qualitative:** All three `docs/mcp-connect/*.md` files reflect the PAT path; `cursor.md` no longer instructs users to copy a JWT from `localStorage`; the Risks row in Epic Brief #231 is explicitly marked closed with a back-reference to this epic.

---

## Risks & Mitigations


| Risk                                                                                                                                                                                                                                                                                                             | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RLS strategy** — how do we mint a user-scoped Supabase client from a PAT? Three candidates: (a) `service_role` + manual `user_id` filter (RLS bypassed = footgun-ridden), (b) mint a short-lived Supabase JWT and forward it to `createClient()`, (c) admin API impersonation (overkill, latency, complexity). | **Resolved by Tech Plan: option (b) with the project `SUPABASE_JWT_SECRET`** (not a dedicated secret as initially leaned). PostgREST can only validate JWTs signed with the project key without JWKS infrastructure we don't run. The "dedicated secret = isolated blast radius" framing was security theater — the Edge Function already holds `service_role`, so JWT-forging power adds no real privilege. See `file:docs/Tech_Plan_—_Long-Lived_MCP_Auth_via_Personal_Access_Tokens.md`. |
| **Hashing choice** — bcrypt is unworkable on a hot auth path (10-100ms/call); PATs are high-entropy random secrets, not low-entropy passwords.                                                                                                                                                                   | Default to **HMAC-SHA-256 with a server-side pepper** (constant-time, no per-request bcrypt cost). Tech Plan to confirm pepper storage / rotation strategy.                                                                                                                                                                                                                                                                                                                                 |
| **Leaked PAT = full account compromise until revoked**                                                                                                                                                                                                                                                           | Default 90-day expiry, revocation UI, `last_used_at` visibility. Per-PAT rate-limit deferred to v1 — accepted risk.                                                                                                                                                                                                                                                                                                                                                                         |
| `**never`-lifetime tokens become zombies**                                                                                                                                                                                                                                                                       | Allowed in v0 per product call, but the UI must warn ("non-expiring tokens are harder to audit"). Revisit in v1 if abuse data shows up.                                                                                                                                                                                                                                                                                                                                                     |
| **PAT escalation** — using a PAT to mint another PAT would let a leak bootstrap permanence                                                                                                                                                                                                                       | The `/settings/api-tokens` create endpoint accepts only browser-session auth (Supabase JWT), never a PAT-authenticated request.                                                                                                                                                                                                                                                                                                                                                             |
| **Hot-row contention on `last_used_at`**                                                                                                                                                                                                                                                                         | Stateless write-if-stale: only update when the stored value is older than 1 minute. No in-memory debounce, no Redis, no cold-start state loss.                                                                                                                                                                                                                                                                                                                                              |


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

