/**
 * Personal Access Token format helpers.
 *
 * Shared between the `mcp` Edge Function (verify path) and the `create-pat`
 * Edge Function (generate path). All functions are pure (no env access, no
 * I/O) — the pepper is always passed in as an argument so callers can be
 * unit-tested without `Deno.env`.
 *
 * !! IMPORTANT
 * The HMAC pepper passed to `hashPAT` is operationally immutable for the
 * life of v0. Rotating it invalidates every existing PAT row's `token_hash`
 * (mass-revoke equivalent). See the migration
 * `..._create_personal_access_tokens.sql` invariant (1).
 */

/** Plaintext prefix. The auth router branches on this. */
export const PAT_PREFIX = "glp_"

/** Number of base58 characters after the `glp_` prefix. */
export const PAT_BODY_LENGTH = 32

/** Total plaintext length: `glp_` + 32 base58 chars. */
export const PAT_TOTAL_LENGTH = PAT_PREFIX.length + PAT_BODY_LENGTH

/**
 * Number of leading characters (including the `glp_` prefix) stored as the
 * `prefix` column for UI display ("starts with glp_4Hxz…").
 */
export const PAT_DISPLAY_PREFIX_LENGTH = 8

// Base58 alphabet — Bitcoin / IPFS variant. Excludes 0 / O / 1 / l / I so the
// plaintext is copy-paste safe (no easily-confused glyphs).
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// 256 mod 58 = 8 — discard bytes >= 232 to avoid modulo bias when sampling
// base58 indices from a uniform byte source.
const BASE58_REJECT_THRESHOLD = 232

const encoder = new TextEncoder()

/**
 * Generate a fresh PAT plaintext.
 *
 * Format: `glp_` + 32 chars from the base58 alphabet → ~187 bits of entropy.
 * Uses rejection sampling against `crypto.getRandomValues` with a 3× overdraw
 * so underflow is astronomically improbable (P < 10⁻¹⁸); we throw rather
 * than loop, which surfaces entropy regressions instead of hiding them.
 */
export function generatePAT(): string {
  const buf = new Uint8Array(PAT_BODY_LENGTH * 3)
  crypto.getRandomValues(buf)

  const chars = Array.from(buf)
    .filter((b) => b < BASE58_REJECT_THRESHOLD)
    .slice(0, PAT_BODY_LENGTH)
    .map((b) => BASE58_ALPHABET[b % 58])

  if (chars.length < PAT_BODY_LENGTH) {
    throw new Error(
      "generatePAT: rejection sampling underflowed; getRandomValues entropy issue?",
    )
  }

  return PAT_PREFIX + chars.join("")
}

/**
 * HMAC-SHA-256 the **full plaintext** (including the `glp_` prefix) with the
 * server-side pepper. Returns lowercase hex (64 chars).
 *
 * Hashing the full plaintext is deliberate: what the user pastes into their
 * MCP client config is exactly what gets verified — no stripping, no
 * canonicalization. Verify-time and create-time must produce the same digest
 * for the same input string.
 */
export async function hashPAT(
  plaintext: string,
  pepper: string,
): Promise<string> {
  if (!pepper) {
    throw new Error("hashPAT: pepper must be a non-empty string")
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(plaintext)),
  )
  return toHex(sig)
}

/**
 * First `PAT_DISPLAY_PREFIX_LENGTH` chars of the plaintext, stored verbatim
 * in the `prefix` column. UI shows "starts with `glp_4Hxz…`" so users can
 * correlate after the one-time secret display.
 *
 * Throws on inputs that don't look like a PAT — those are programmer errors,
 * not user input.
 */
export function extractPrefix(plaintext: string): string {
  if (!plaintext.startsWith(PAT_PREFIX)) {
    throw new Error(`extractPrefix: input does not start with "${PAT_PREFIX}"`)
  }
  if (plaintext.length < PAT_DISPLAY_PREFIX_LENGTH) {
    throw new Error("extractPrefix: input shorter than display prefix length")
  }
  return plaintext.slice(0, PAT_DISPLAY_PREFIX_LENGTH)
}

/** Cheap check used by the auth router — does the bearer look like a PAT? */
export function isPATFormat(token: string): boolean {
  return token.startsWith(PAT_PREFIX)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
