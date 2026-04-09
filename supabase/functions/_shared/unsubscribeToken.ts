/** HMAC-signed payload for one-click unsubscribe links (feedback notifications). */

const encoder = new TextEncoder()

export type UnsubscribePayload = { u: string; exp: number; p: "feedback" }

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

export async function signUnsubscribeToken(
  payload: UnsubscribePayload,
  secret: string,
): Promise<string> {
  const body = base64urlEncode(encoder.encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)))
  return `${body}.${base64urlEncode(sig)}`
}

export async function verifyUnsubscribeToken(
  token: string,
  secret: string,
): Promise<UnsubscribePayload | null> {
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, sigB64] = parts
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  )
  let sig: Uint8Array
  try {
    sig = base64urlDecode(sigB64)
  } catch {
    return null
  }
  const ok = await crypto.subtle.verify("HMAC", key, sig, encoder.encode(body))
  if (!ok) return null
  try {
    const json = JSON.parse(new TextDecoder().decode(base64urlDecode(body))) as Record<string, unknown>
    if (typeof json.u !== "string" || typeof json.exp !== "number" || json.p !== "feedback") {
      return null
    }
    if (Date.now() / 1000 > json.exp) return null
    return { u: json.u, exp: json.exp, p: "feedback" }
  } catch {
    return null
  }
}

export function unsubscribeSecret(): string | null {
  return Deno.env.get("UNSUBSCRIBE_SECRET")?.trim() || Deno.env.get("WEBHOOK_SECRET")?.trim() || null
}
