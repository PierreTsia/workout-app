/**
 * Browser-facing shape of a Personal Access Token row.
 *
 * IMPORTANT — `token_hash` is intentionally NOT in this type. The hashed value
 * never leaves the database; the plaintext is shown ONCE at creation time via
 * `CreatePATResponse.token` and after that only the `prefix` (e.g. "glp_4Hxz")
 * is visible to the user.
 *
 * See docs/Tech_Plan_—_Long-Lived_MCP_Auth_via_Personal_Access_Tokens.md.
 */
export interface PersonalAccessToken {
  id: string
  user_id: string
  name: string
  prefix: string
  expires_at: string | null
  last_used_at: string | null
  created_at: string
}

export type PATLifetime = 30 | 90 | 365 | null

export interface CreatePATInput {
  name: string
  lifetime_days: PATLifetime
}

export interface CreatePATResponse {
  token: string
  prefix: string
  expires_at: string | null
}
