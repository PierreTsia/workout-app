/**
 * Manual HS256 JWT signer using the Web Crypto API.
 *
 * Inlined rather than depending on `npm:jose` so the MCP Edge Function keeps
 * a zero-npm-dep cold-start budget (per Epic #231 perf target). The crypto
 * footprint mirrors `_shared/unsubscribeToken.ts` — same HMAC-SHA-256
 * primitive, different envelope shape.
 *
 * Only sign is implemented. Verification is handled upstream by either:
 *   - `supabase.auth.getUser(jwt)` (talks to GoTrue, which validates the
 *     signature against the project signing key) — used in `create-pat`
 *   - PostgREST itself when the JWT is forwarded as the user-context auth
 *     header — used in the MCP read/write path
 */

export type JWTClaims = Record<string, unknown>

const encoder = new TextEncoder()

function base64urlEncode(bytes: Uint8Array): string {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("")
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlEncodeJson(obj: unknown): string {
  return base64urlEncode(encoder.encode(JSON.stringify(obj)))
}

/**
 * Sign a JWT with HS256.
 *
 * Returns the compact serialization: `header.payload.signature`. The caller
 * is responsible for putting `iat` / `exp` / `iss` / etc. in `claims` —
 * this function is intentionally claim-agnostic.
 */
export async function signHS256(
  claims: JWTClaims,
  secret: string,
): Promise<string> {
  if (!secret) {
    throw new Error("signHS256: secret must be a non-empty string")
  }
  const headerB64 = b64urlEncodeJson({ alg: "HS256", typ: "JWT" })
  const payloadB64 = b64urlEncodeJson(claims)
  const signingInput = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput)),
  )
  return `${signingInput}.${base64urlEncode(sig)}`
}
