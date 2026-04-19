/**
 * Supabase Auth OAuth 2.1 server — API exists at runtime but isn't
 * typed in @supabase/supabase-js yet. Remove this file once the
 * package ships official types.
 */

interface SupabaseOAuthResult<T> {
  data: T | null
  error: { message: string } | null
}

interface SupabaseOAuthRedirect {
  redirect_to: string
}

interface SupabaseAuthorizationDetails {
  authorization_id: string
  application?: { name?: string; icon_uri?: string }
  scope?: string
}

declare module "@supabase/gotrue-js" {
  interface GoTrueClient {
    oauth: {
      getAuthorizationDetails(
        id: string,
      ): Promise<SupabaseOAuthResult<SupabaseAuthorizationDetails | SupabaseOAuthRedirect>>
      approveAuthorization(
        id: string,
      ): Promise<SupabaseOAuthResult<SupabaseOAuthRedirect>>
      denyAuthorization(
        id: string,
      ): Promise<SupabaseOAuthResult<SupabaseOAuthRedirect>>
    }
  }
}
