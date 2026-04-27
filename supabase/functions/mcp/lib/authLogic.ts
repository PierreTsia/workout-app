/**
 * Pure authorization-routing logic for the MCP Edge Function.
 *
 * Split out of `auth.ts` so the routing decision (which is the entire
 * security boundary between OAuth bearers and PATs) is unit-testable
 * without triggering imports of `https://esm.sh/...` modules — those
 * top-level URL imports break vitest under Node.
 *
 * `auth.ts` is the thin wiring layer that reads env, builds the production
 * deps, and calls `resolveAuthLogic` here.
 */

import { isPATFormat } from "../../_shared/patFormat.ts"
import type { VerifiedPAT } from "./pat.ts"

const BEARER_PREFIX = "Bearer "

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnauthorizedError"
  }
}

export type BearerKind = "missing" | "pat" | "other"

/**
 * Strip an optional `Bearer ` prefix and surrounding whitespace.
 *
 * Both `"Bearer glp_…"` and `"glp_…"` are accepted on input — the latter
 * shouldn't reach us in practice (the MCP entry point requires the prefix),
 * but the resolver must be robust if it ever does.
 */
export function stripBearer(authHeader: string): string {
  if (!authHeader) return ""
  return authHeader.startsWith(BEARER_PREFIX)
    ? authHeader.slice(BEARER_PREFIX.length).trim()
    : authHeader.trim()
}

/** Classify a stripped bearer string. */
export function classifyBearer(token: string): BearerKind {
  if (!token) return "missing"
  if (isPATFormat(token)) return "pat"
  return "other"
}

/**
 * Dependencies injected into `resolveAuthLogic`. The generic `C` is the
 * Supabase client type — kept generic so this module never has to import
 * `@supabase/supabase-js` types.
 */
export type ResolveAuthDeps<C> = {
  verifyPAT: (token: string) => Promise<VerifiedPAT | null>
  mintInternalJWT: (userId: string) => Promise<string>
  bumpLastUsed: (patId: string) => Promise<void>
  createUserClient: (authHeader: string) => C
}

/**
 * Pure routing logic.
 *
 * Invariants (any change here is a regression risk — see authLogic.test.ts):
 *  - PAT path: awaits `verifyPAT` → throws UnauthorizedError on null,
 *    awaits `mintInternalJWT`, fires `bumpLastUsed` WITHOUT `await`
 *    (auth response is NEVER gated on the bump), returns user client
 *    keyed by the freshly-minted JWT.
 *  - Non-PAT path: returns `createUserClient(authHeader)` unchanged
 *    — zero behavioral change for OAuth/Supabase JWT clients.
 *  - `bumpLastUsed` errors are swallowed. The auth response must never
 *    fail because the timestamp write failed.
 */
export async function resolveAuthLogic<C>(
  authHeader: string,
  deps: ResolveAuthDeps<C>,
): Promise<C> {
  const token = stripBearer(authHeader)
  const kind = classifyBearer(token)

  if (kind !== "pat") {
    return deps.createUserClient(authHeader)
  }

  const verified = await deps.verifyPAT(token)
  if (!verified) {
    throw new UnauthorizedError("Invalid or expired personal access token")
  }

  const internalJwt = await deps.mintInternalJWT(verified.userId)

  // Fire-and-forget. Do NOT await. If you ever feel tempted to add `await`,
  // re-read the failure-mode table in the tech plan first — auth latency is
  // the user-visible regression and `bumpLastUsed` failure is by design
  // tolerable.
  //
  // `Promise.resolve().then(...)` wraps the call so BOTH synchronous and
  // asynchronous throws are captured by the `.catch`. A plain
  // `deps.bumpLastUsed(...).catch(...)` would let synchronous throws escape
  // (no Promise to chain on yet) — the regression test in authLogic.test.ts
  // locks this contract.
  Promise.resolve()
    .then(() => deps.bumpLastUsed(verified.patId))
    .catch((err) => console.warn("bumpLastUsed: unexpected throw", err))

  return deps.createUserClient(`${BEARER_PREFIX}${internalJwt}`)
}
