/**
 * PAT verification, internal-JWT minting, and `last_used_at` debouncing.
 *
 * !! IMPORTANT
 * The pepper used by `verifyPATAgainstDB` is operationally immutable for
 * the life of v0. Rotating `PAT_PEPPER` invalidates every existing PAT row's
 * `token_hash` (mass-revoke equivalent). See migration
 * `..._create_personal_access_tokens.sql` invariant (1).
 *
 * Functions here are pure given config — env access happens in `auth.ts`,
 * which keeps the domain logic unit-testable without faking `Deno.env`.
 */

import { hashPAT, isPATFormat } from "../../_shared/patFormat.ts"
import { signHS256 } from "./jwt.ts"

// Loose typing for the supabase client — we only use a small slice of its
// surface, and the @supabase/supabase-js types live behind an esm.sh URL
// that vitest can't resolve under jsdom. The PAT path is exercised in
// production end-to-end; the type name is documentation, not enforcement.
type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        or: (filter: string) => {
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>
        }
      }
    }
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        or: (filter: string) => Promise<{ data: unknown; error: unknown }>
      }
    }
  }
}

export type VerifiedPAT = { patId: string; userId: string }

export type InternalJWTConfig = {
  jwtSecret: string
  supabaseUrl: string
  ttlSeconds?: number
}

const DEFAULT_INTERNAL_JWT_TTL_SECONDS = 300
const DEFAULT_LAST_USED_DEBOUNCE_SECONDS = 60

/**
 * Verify a PAT bearer string against the `personal_access_tokens` table.
 *
 * Defensively rejects inputs that don't start with `glp_` so an OAuth JWT
 * accidentally routed here can never be cross-checked against the hash table.
 * Returns null for any verification failure (bad prefix, expired, deleted,
 * mismatched).
 *
 * Hashes the **full plaintext including the `glp_` prefix** — what the user
 * pastes is exactly what the create-time hash was computed from. No stripping.
 *
 * Expiry filtering is server-side via PostgREST: the row is excluded from
 * the SELECT result if `expires_at <= now()`. Clock-drift between Edge
 * Function host and Postgres is irrelevant — the comparison happens in the
 * DB.
 */
export async function verifyPATAgainstDB(
  token: string,
  config: { pepper: string; supabase: SupabaseLike },
): Promise<VerifiedPAT | null> {
  if (!isPATFormat(token)) return null

  const hash = await hashPAT(token, config.pepper)
  const nowISO = new Date().toISOString()

  const { data, error } = await config.supabase
    .from("personal_access_tokens")
    .select("id, user_id")
    .eq("token_hash", hash)
    .or(`expires_at.is.null,expires_at.gt.${nowISO}`)
    .maybeSingle()

  if (error) {
    console.error("verifyPATAgainstDB: lookup failed", error)
    return null
  }
  if (!data) return null

  const row = data as { id: string; user_id: string }
  return { patId: row.id, userId: row.user_id }
}

/**
 * Mint a short-lived internal JWT for PAT-authenticated MCP requests.
 *
 * Signed with the project's main JWT secret (exposed to this function via the
 * `PAT_JWT_SECRET` env var) so PostgREST validates it identically to a real
 * Supabase Auth token. The `aal: 'pat'` claim is the static marker that
 * `create-pat` uses to reject PAT-derived JWTs (defends against PAT-from-PAT
 * escalation).
 *
 * 5-min TTL is generous (a single MCP request never spans 5 minutes) and we
 * re-mint on every request — no clock-sync gymnastics required.
 */
export async function mintInternalJWT(
  userId: string,
  config: InternalJWTConfig,
): Promise<string> {
  if (!config.jwtSecret) {
    throw new Error("mintInternalJWT: jwtSecret is required")
  }
  if (!userId) {
    throw new Error("mintInternalJWT: userId is required")
  }

  const now = Math.floor(Date.now() / 1000)
  const ttl = config.ttlSeconds ?? DEFAULT_INTERNAL_JWT_TTL_SECONDS

  return signHS256(
    {
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iss: `${config.supabaseUrl}/auth/v1`,
      iat: now,
      exp: now + ttl,
      aal: "pat",
    },
    config.jwtSecret,
  )
}

/**
 * Stateless write-if-stale `last_used_at` update.
 *
 * Single round-trip: Postgres atomically applies the predicate
 * `last_used_at IS NULL OR last_used_at < ?` so concurrent calls within the
 * debounce window result in zero or one write — no row contention, no
 * in-memory state.
 *
 * Intended to be called fire-and-forget from the auth resolver. Errors are
 * logged and swallowed; failure here must NEVER fail the auth response.
 */
export async function bumpLastUsedIfStale(
  patId: string,
  supabase: SupabaseLike,
  thresholdSeconds = DEFAULT_LAST_USED_DEBOUNCE_SECONDS,
): Promise<void> {
  const now = new Date()
  const threshold = new Date(now.getTime() - thresholdSeconds * 1000)

  // Contract: this function NEVER throws. Both PostgREST-shaped `{ error }`
  // results and runtime rejections (network failures, Deno bugs, …) are
  // logged and swallowed. The auth resolver chains `.catch` on top as
  // defense in depth, but the primary swallow happens here so the contract
  // is local to this file.
  try {
    const { error } = await supabase
      .from("personal_access_tokens")
      .update({ last_used_at: now.toISOString() })
      .eq("id", patId)
      .or(`last_used_at.is.null,last_used_at.lt.${threshold.toISOString()}`)

    if (error) {
      console.warn("bumpLastUsedIfStale: update failed", error)
    }
  } catch (err) {
    console.warn("bumpLastUsedIfStale: unexpected exception", err)
  }
}
