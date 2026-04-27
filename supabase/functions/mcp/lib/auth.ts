/**
 * Authorization resolver for the MCP Edge Function.
 *
 * Single point of branching between OAuth/Supabase JWT bearers and `glp_…`
 * Personal Access Tokens. Tools and resource handlers see a unified
 * user-context Supabase client regardless of the bearer flavor.
 *
 * - OAuth/Supabase JWT  →  forwarded as-is (zero behavioral change)
 * - `glp_…` PAT         →  verified against `personal_access_tokens`,
 *                          a 5-min internal JWT is minted with `aal: 'pat'`,
 *                          and `last_used_at` is bumped fire-and-forget.
 *
 * On PAT verification failure this throws `UnauthorizedError`. The MCP entry
 * point catches it at the request boundary and returns 401 +
 * `WWW-Authenticate` so existing client retry logic surfaces the failure.
 */

import { createServiceClient } from "../../_shared/supabase.ts"
import { isPATFormat } from "../../_shared/patFormat.ts"
import { createUserClient } from "./supabaseClient.ts"
import {
  bumpLastUsedIfStale,
  mintInternalJWT,
  verifyPATAgainstDB,
} from "./pat.ts"

const BEARER_PREFIX = "Bearer "

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnauthorizedError"
  }
}

type SupabaseUserClient = ReturnType<typeof createUserClient>

/**
 * Resolve an Authorization header into a Supabase client correctly scoped
 * to the user, regardless of bearer flavor.
 */
export async function resolveAuth(
  authHeader: string,
): Promise<SupabaseUserClient> {
  const token = stripBearer(authHeader)

  if (!token || !isPATFormat(token)) {
    return createUserClient(authHeader)
  }

  const pepper = requireEnv("PAT_PEPPER")
  const jwtSecret = requireEnv("SUPABASE_JWT_SECRET")
  const supabaseUrl = requireEnv("SUPABASE_URL")

  const serviceClient = createServiceClient()

  const verified = await verifyPATAgainstDB(token, {
    pepper,
    supabase: serviceClient,
  })
  if (!verified) {
    throw new UnauthorizedError("Invalid or expired personal access token")
  }

  const internalJwt = await mintInternalJWT(verified.userId, {
    jwtSecret,
    supabaseUrl,
  })

  // Fire-and-forget. The auth response must NEVER be gated on this.
  bumpLastUsedIfStale(verified.patId, serviceClient).catch((err) =>
    console.warn("bumpLastUsedIfStale: unexpected throw", err),
  )

  return createUserClient(`${BEARER_PREFIX}${internalJwt}`)
}

function stripBearer(authHeader: string): string {
  return authHeader.startsWith(BEARER_PREFIX)
    ? authHeader.slice(BEARER_PREFIX.length).trim()
    : authHeader.trim()
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} env var is required`)
  return v
}
