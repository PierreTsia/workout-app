/**
 * Production wiring layer for the MCP authorization resolver.
 *
 * Reads env (`PAT_PEPPER`, `SUPABASE_JWT_SECRET`, `SUPABASE_URL`), builds
 * the service client + injected deps, and delegates the routing decision
 * to `resolveAuthLogic` in `authLogic.ts`. Splitting the env-touching
 * wiring from the pure logic keeps the security-critical routing decision
 * unit-testable.
 *
 * On PAT verification failure this throws `UnauthorizedError`. The MCP
 * entry point catches it at the request boundary and returns 401 +
 * `WWW-Authenticate` so existing client retry logic surfaces the failure.
 */

import { createServiceClient } from "../../_shared/supabase.ts"
import { createUserClient } from "./supabaseClient.ts"
import {
  bumpLastUsedIfStale,
  mintInternalJWT,
  verifyPATAgainstDB,
} from "./pat.ts"
import { resolveAuthLogic } from "./authLogic.ts"

// Re-export so existing callers (`mcp/index.ts`) that import
// UnauthorizedError from auth.ts don't need to change.
export { UnauthorizedError } from "./authLogic.ts"

type SupabaseUserClient = ReturnType<typeof createUserClient>

/**
 * Resolve an Authorization header into a Supabase client correctly scoped
 * to the user, regardless of bearer flavor.
 */
export async function resolveAuth(
  authHeader: string,
): Promise<SupabaseUserClient> {
  const pepper = requireEnv("PAT_PEPPER")
  const jwtSecret = requireEnv("SUPABASE_JWT_SECRET")
  const supabaseUrl = requireEnv("SUPABASE_URL")

  const serviceClient = createServiceClient()

  return resolveAuthLogic<SupabaseUserClient>(authHeader, {
    verifyPAT: (token) =>
      verifyPATAgainstDB(token, { pepper, supabase: serviceClient }),
    mintInternalJWT: (userId) =>
      mintInternalJWT(userId, { jwtSecret, supabaseUrl }),
    bumpLastUsed: (patId) => bumpLastUsedIfStale(patId, serviceClient),
    createUserClient,
  })
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} env var is required`)
  return v
}
