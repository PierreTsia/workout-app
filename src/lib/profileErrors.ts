/** Thrown when display_name violates unique index (Postgres 23505). */
export class DisplayNameTakenError extends Error {
  constructor() {
    super("DisplayNameTakenError")
    this.name = "DisplayNameTakenError"
  }
}

export function isDisplayNameTakenError(e: unknown): boolean {
  return e instanceof DisplayNameTakenError
}

/**
 * Thrown when the Supabase JWT is expired or RLS rejects the request,
 * surfaced as PostgREST `PGRST301` (JWT expired) or Postgres `42501`
 * (insufficient privilege / RLS policy violation). On iOS Safari with
 * aggressive tab eviction this is the dominant onboarding failure mode
 * — the user dwells on the questionnaire long enough for the access
 * token to expire, then `auth.uid()` returns null and any RLS-protected
 * upsert hard-rejects with one of these two codes (#348).
 */
export class AuthExpiredError extends Error {
  constructor() {
    super("AuthExpiredError")
    this.name = "AuthExpiredError"
  }
}

export function isAuthExpiredError(e: unknown): boolean {
  return e instanceof AuthExpiredError
}
