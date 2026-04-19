/**
 * @supabase/auth-js does not type the OAuth 2.1 server methods yet.
 * This wrapper isolates the single unsafe cast — remove when the
 * package ships official types.
 */
import { supabase } from "./supabase"

interface OAuthResult<T> {
  data: T | null
  error: { message: string } | null
}

export interface OAuthRedirect {
  redirect_to: string
}

export interface AuthorizationDetails {
  authorization_id: string
  application?: { name?: string; icon_uri?: string }
  scope?: string
}

interface OAuthApi {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<OAuthResult<AuthorizationDetails | OAuthRedirect>>
  approveAuthorization: (id: string) => Promise<OAuthResult<OAuthRedirect>>
  denyAuthorization: (id: string) => Promise<OAuthResult<OAuthRedirect>>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseOAuth: OAuthApi = (supabase.auth as any).oauth
