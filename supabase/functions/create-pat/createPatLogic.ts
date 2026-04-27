/**
 * Pure logic for the `create-pat` Edge Function.
 *
 * Body validation, anti-escalation claim check, expiry computation. Split
 * out of `index.ts` so the security-critical decisions (PAT-from-PAT
 * rejection, lifetime allow-list, name length cap) are unit-testable
 * without `Deno.env` or `https://esm.sh/...` imports.
 */

export const PAT_QUOTA = 10

/** Allowed values for `lifetime_days`. `null` means "never expires". */
export const PAT_LIFETIME_OPTIONS = [30, 90, 365, null] as const
export type PATLifetime = (typeof PAT_LIFETIME_OPTIONS)[number]

export const PAT_NAME_MIN_LENGTH = 1
export const PAT_NAME_MAX_LENGTH = 64

export type CreatePATBody = {
  name: string
  lifetime_days: PATLifetime
}

export type ValidationOk = { ok: true; value: CreatePATBody }
export type ValidationErr = {
  ok: false
  status: 400
  body: { error: string; field?: string }
}
export type ValidationResult = ValidationOk | ValidationErr

/**
 * Validate the JSON body of a `create-pat` request.
 *
 * - `name`: required string, trimmed, 1..64 chars after trim.
 * - `lifetime_days`: required, one of 30 / 90 / 365 / null. Must be sent
 *   explicitly — there is no default to avoid silent-success scenarios.
 */
export function validateCreatePATBody(body: unknown): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      body: { error: "Body must be a JSON object" },
    }
  }
  const obj = body as Record<string, unknown>

  if (typeof obj.name !== "string") {
    return {
      ok: false,
      status: 400,
      body: { error: "name must be a string", field: "name" },
    }
  }
  const name = obj.name.trim()
  if (name.length < PAT_NAME_MIN_LENGTH) {
    return {
      ok: false,
      status: 400,
      body: { error: "name must not be empty", field: "name" },
    }
  }
  if (name.length > PAT_NAME_MAX_LENGTH) {
    return {
      ok: false,
      status: 400,
      body: {
        error: `name must be ${PAT_NAME_MAX_LENGTH} characters or fewer`,
        field: "name",
      },
    }
  }

  const lifetime = obj.lifetime_days
  if (!isValidLifetime(lifetime)) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "lifetime_days must be one of 30, 90, 365, or null",
        field: "lifetime_days",
      },
    }
  }

  return { ok: true, value: { name, lifetime_days: lifetime } }
}

function isValidLifetime(v: unknown): v is PATLifetime {
  return v === null || v === 30 || v === 90 || v === 365
}

export type AALCheckResult =
  | { ok: true }
  | { ok: false; reason: "pat-derived" | "malformed" }

/**
 * Reject JWTs that were minted by the MCP function as PAT-derived tokens.
 *
 * The signature MUST already have been validated upstream (e.g. via
 * `supabase.auth.getUser`). This function decodes the payload to inspect
 * the `aal` claim only — it is NOT a signature check.
 *
 * Anti-escalation invariant: a caller authenticated by a PAT cannot mint
 * additional PATs (`aal: 'pat'` is the static marker the MCP function
 * always sets). This guards against PAT-from-PAT escalation as a property
 * of the code, not just of the call graph.
 */
export function checkJWTNotPATDerived(jwt: string): AALCheckResult {
  const parts = jwt.split(".")
  if (parts.length !== 3) return { ok: false, reason: "malformed" }

  try {
    const payloadJson = new TextDecoder().decode(base64urlDecode(parts[1]))
    const claims = JSON.parse(payloadJson) as Record<string, unknown>
    if (claims.aal === "pat") {
      return { ok: false, reason: "pat-derived" }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: "malformed" }
  }
}

/**
 * Compute `expires_at` ISO string for a given lifetime.
 *
 * `null` → `null` (never expires; UI warned). Otherwise `now + days`.
 */
export function computeExpiresAt(
  lifetime_days: PATLifetime,
  now: Date = new Date(),
): string | null {
  if (lifetime_days === null) return null
  return new Date(now.getTime() + lifetime_days * 86_400 * 1000).toISOString()
}

/** Postgres unique-violation SQLSTATE — used to map `(user_id, name)` collisions to 409. */
export const PG_UNIQUE_VIOLATION = "23505"

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
