/**
 * @supabase/auth-js v2.103.3 ships the OAuth 2.1 server methods at runtime
 * (`supabase.auth.oauth.*` — see GoTrueClient.js line 155) but does not yet
 * declare them in its `.d.ts`. This wrapper isolates the unsafe cast and
 * also pins down two non-obvious bits of SDK behavior:
 *
 *  - The server returns `redirect_url` (NOT `redirect_to` — the Supabase docs
 *    page at /auth/oauth-server/oauth-flows is wrong; the Go source uses
 *    `RedirectURL string \`json:"redirect_url"\``).
 *  - `approveAuthorization` / `denyAuthorization` will silently call
 *    `window.location.assign(response.data.redirect_url)` themselves unless
 *    `skipBrowserRedirect: true` is passed. We always opt out so the consent
 *    page owns navigation + post-redirect UX (issue #292).
 */
import { supabase } from "./supabase"

interface OAuthResult<T> {
  data: T | null
  error: { message: string } | null
}

export interface OAuthRedirect {
  redirect_url: string
}

export interface AuthorizationDetails {
  authorization_id: string
  // The server occasionally exposes the OAuth client metadata under either
  // `client` or `application`; accept both rather than crash if either name
  // changes upstream.
  client?: { name?: string; icon_uri?: string }
  application?: { name?: string; icon_uri?: string }
  scope?: string
}

export interface OAuthConsentOptions {
  skipBrowserRedirect?: boolean
}

interface OAuthApi {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<OAuthResult<AuthorizationDetails | OAuthRedirect>>
  approveAuthorization: (
    id: string,
    options?: OAuthConsentOptions,
  ) => Promise<OAuthResult<OAuthRedirect>>
  denyAuthorization: (
    id: string,
    options?: OAuthConsentOptions,
  ) => Promise<OAuthResult<OAuthRedirect>>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseOAuth: OAuthApi = (supabase.auth as any).oauth
