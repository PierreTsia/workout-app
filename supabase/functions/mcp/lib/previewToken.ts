/**
 * HMAC-signed **Preview Token** (ADR 0028) — the server-side consent guard for a
 * view-initiated apply.
 *
 * `update_program` `dry_run:true` mints a token carrying the exact previewed patch, the
 * user id and an expiry. `apply_program_patch` requires it. The host's
 * `_meta.ui.visibility:["app"]` is host-enforced and cannot gate a non-compliant host;
 * the signature is the guard that survives any host. Same shape as
 * `file:supabase/functions/_shared/unsubscribeToken.ts` — base64url + HMAC-SHA256.
 *
 * Env access is isolated in `previewSecret()` so the pure functions stay unit-testable
 * without faking `Deno.env` (mirrors `lib/pat.ts`).
 */

const encoder = new TextEncoder()

/** Minutes a preview stays applicable — long enough to read and click, short enough not to linger. */
export const PREVIEW_TTL_SECONDS = 15 * 60

export type PreviewPayload = {
  /** Authenticated user the preview belongs to. */
  u: string
  /** Expiry, epoch seconds. */
  exp: number
  /** Program being patched. */
  p: string
  /** The exact `update_program` arguments the model sent, minus `dry_run` / `confirm`. */
  patch: Record<string, unknown>
}

function base64urlEncode(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  )
}

export async function mintPreviewToken(
  payload: PreviewPayload,
  secret: string,
): Promise<string> {
  const body = base64urlEncode(encoder.encode(JSON.stringify(payload)))
  const key = await hmacKey(secret, ["sign"])
  // WebCrypto wants a BufferSource; the lib types TextEncoder's output as ArrayBufferLike.
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body) as BufferSource))
  return `${body}.${base64urlEncode(sig)}`
}

/** Returns the payload only when the signature verifies and the token has not expired. */
export async function verifyPreviewToken(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<PreviewPayload | null> {
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, sigB64] = parts

  let sig: Uint8Array
  try {
    sig = base64urlDecode(sigB64)
  } catch {
    return null
  }

  const key = await hmacKey(secret, ["verify"])
  const ok = await crypto.subtle.verify("HMAC", key, sig as BufferSource, encoder.encode(body) as BufferSource)
  if (!ok) return null

  try {
    const json = JSON.parse(
      new TextDecoder().decode(base64urlDecode(body)),
    ) as Record<string, unknown>
    if (
      typeof json.u !== "string" ||
      typeof json.exp !== "number" ||
      typeof json.p !== "string" ||
      typeof json.patch !== "object" ||
      json.patch === null
    ) {
      return null
    }
    if (json.exp <= nowSeconds) return null
    return { u: json.u, exp: json.exp, p: json.p, patch: json.patch as Record<string, unknown> }
  } catch {
    return null
  }
}

/**
 * The dedicated signing secret, with a fallback so an un-configured environment degrades
 * to "no token" (the view hides Apply) rather than crashing the dry run.
 */
export function previewSecret(): string | null {
  const deno = (globalThis as {
    Deno?: { env?: { get: (k: string) => string | undefined } }
  }).Deno
  return (
    deno?.env?.get("MCP_PREVIEW_SECRET")?.trim() ||
    deno?.env?.get("WEBHOOK_SECRET")?.trim() ||
    null
  )
}
