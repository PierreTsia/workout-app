# T64 — OAuth 2.1 + Consent Page

## Goal

Enable Supabase OAuth 2.1 so that MCP clients (Claude Desktop, Le Chat) can authenticate through a standard OAuth flow with dynamic client registration. Build the `/oauth/consent` page in the React app where users approve or deny agent access to their training data.

## Dependencies

None. This ticket is independent of the Edge Function work (T61–T63) and can be done in parallel. The MCP function already accepts Bearer tokens — OAuth 2.1 provides a standards-compliant way for MCP clients to obtain those tokens.

## Scope

### Supabase OAuth 2.1 configuration

**`file:supabase/config.toml`** — add:

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = true
```

**Supabase Dashboard** (manual, production):

| Setting | Value |
|---|---|
| Authentication → OAuth Server | Enable |
| Authorization URL path | `/oauth/consent` |
| Dynamic client registration | Enable |

Once enabled, Supabase exposes:

| Endpoint | URL (production) |
|---|---|
| Discovery | `https://<ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1` |
| Authorization | `https://<ref>.supabase.co/auth/v1/oauth/authorize` |
| Token | `https://<ref>.supabase.co/auth/v1/oauth/token` |
| JWKS | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` |

### Consent page: `OAuthConsentPage.tsx`

| Item | Detail |
|---|---|
| File | `src/pages/OAuthConsentPage.tsx` |
| Route | `/oauth/consent` — add to `file:src/router/` |
| URL param | `authorization_id` (from Supabase redirect) |

**Page flow:**

1. Extract `authorization_id` from `useSearchParams()`
2. Check active Supabase session — if none, redirect to `/login` with return URL preserving `authorization_id`
3. Call `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` to retrieve client name, requested scopes
4. Render consent screen
5. On **Approve**: call `supabase.auth.oauth.approveAuthorization(authorization_id)` — Supabase handles redirect back to MCP client with authorization code
6. On **Deny**: call `supabase.auth.oauth.denyAuthorization(authorization_id)` — MCP client gets `access_denied`

**UI components:**

- shadcn `Card` containing: app logo/placeholder icon, client name (from auth details), scope list (formatted as bullet points), two buttons
- `Button` (primary): "Authorize" / "Autoriser"
- `Button` (outline): "Deny" / "Refuser"
- Loading state while fetching auth details
- Error state if `authorization_id` is missing or invalid

### i18n

Add keys to the `common` namespace (`file:src/locales/en/common.json` and `file:src/locales/fr/common.json`):

| Key | EN | FR |
|---|---|---|
| `oauth.consent.title` | Authorize access | Autoriser l'accès |
| `oauth.consent.description` | "{clientName}" wants to access your training data | "{clientName}" souhaite accéder à vos données d'entraînement |
| `oauth.consent.scopes_label` | This app will be able to: | Cette application pourra : |
| `oauth.consent.approve` | Authorize | Autoriser |
| `oauth.consent.deny` | Deny | Refuser |
| `oauth.consent.error` | Authorization request not found or expired | Demande d'autorisation introuvable ou expirée |

### Router update

Add the route to the existing router config. The consent page should be accessible to authenticated users only (same guard as other auth-required routes), but with a fallback redirect to `/login` that preserves the `authorization_id` param.

### Local testing

For local OAuth testing, MCP clients need to reach the local Supabase instance. Options:

- **ngrok** or **Cloudflare Tunnel** to expose `localhost:54321` (Supabase API)
- Configure `jwt_issuer` in `config.toml` to match tunnel URL
- Test full flow: MCP client discovers → redirects to consent → user approves → token issued → MCP client uses token

## Out of Scope

- MCP Edge Function changes (T61–T63 handle that independently)
- Asymmetric JWT signing key migration (recommended by Supabase docs for OAuth, but not required for beta — evaluate after validation)
- Custom OAuth scopes beyond Supabase defaults (`openid`, `email`, `profile`)
- Consent page visual polish beyond functional shadcn components (can iterate in T65)

## Acceptance Criteria

- [ ] `supabase/config.toml` includes `[auth.oauth_server]` block with `enabled = true`, `authorization_url_path = "/oauth/consent"`, and `allow_dynamic_registration = true`
- [ ] Discovery endpoint (`/.well-known/oauth-authorization-server/auth/v1`) returns valid OAuth config locally
- [ ] `/oauth/consent` route exists and renders the consent page
- [ ] Consent page shows client name and requested scopes
- [ ] "Authorize" button calls `approveAuthorization` and redirects back to the requesting client
- [ ] "Deny" button calls `denyAuthorization` and the client receives `access_denied`
- [ ] Unauthenticated users are redirected to `/login` with return to consent page
- [ ] i18n keys exist for both EN and FR
- [ ] No regressions on existing auth flow (Google OAuth login still works)

## References

- [Epic Brief — MCP-First Architecture (#231)](./Epic_Brief_—_MCP-First_Architecture_#231.md) — Scope: item 2
- [Tech Plan — MCP-First Architecture (#231)](./Tech_Plan_—_MCP-First_Architecture_#231.md) — Sections: Key Decisions (Auth), Critical Constraints, Component Responsibilities (`OAuthConsentPage.tsx`), Config Changes
- [Supabase OAuth 2.1 — Getting Started](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [Supabase MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
