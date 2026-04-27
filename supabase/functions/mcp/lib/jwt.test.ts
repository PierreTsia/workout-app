import { describe, expect, it } from "vitest"
import { signHS256 } from "./jwt"

const encoder = new TextEncoder()

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function decodeJson<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(base64urlDecode(s))) as T
}

async function verifyHS256(jwt: string, secret: string): Promise<boolean> {
  const parts = jwt.split(".")
  if (parts.length !== 3) return false
  const [headerB64, payloadB64, sigB64] = parts
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  )
  return crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(sigB64),
    encoder.encode(`${headerB64}.${payloadB64}`),
  )
}

describe("signHS256", () => {
  const SECRET = "test-secret-do-not-use-in-prod"

  it("produces a 3-part compact JWT", async () => {
    const jwt = await signHS256({ sub: "user-1" }, SECRET)
    expect(jwt.split(".")).toHaveLength(3)
  })

  it("encodes header as { alg: HS256, typ: JWT }", async () => {
    const jwt = await signHS256({ sub: "user-1" }, SECRET)
    const header = decodeJson<{ alg: string; typ: string }>(jwt.split(".")[0])
    expect(header).toEqual({ alg: "HS256", typ: "JWT" })
  })

  it("preserves arbitrary claims in the payload", async () => {
    const claims = {
      sub: "user-42",
      role: "authenticated",
      aud: "authenticated",
      iss: "https://example.supabase.co/auth/v1",
      iat: 1714200000,
      exp: 1714200300,
      aal: "pat",
    }
    const jwt = await signHS256(claims, SECRET)
    const decoded = decodeJson<typeof claims>(jwt.split(".")[1])
    expect(decoded).toEqual(claims)
  })

  it("produces a signature that verifies with the same secret", async () => {
    const jwt = await signHS256({ sub: "user-1", iat: 12345 }, SECRET)
    expect(await verifyHS256(jwt, SECRET)).toBe(true)
  })

  it("produces a signature that does NOT verify with a different secret", async () => {
    const jwt = await signHS256({ sub: "user-1", iat: 12345 }, SECRET)
    expect(await verifyHS256(jwt, "wrong-secret")).toBe(false)
  })

  it("uses base64url encoding (no padding, URL-safe alphabet)", async () => {
    const jwt = await signHS256({ sub: "user-1" }, SECRET)
    expect(jwt).not.toMatch(/[+/=]/)
  })

  it("rejects an empty secret", async () => {
    await expect(signHS256({ sub: "user-1" }, "")).rejects.toThrow(/secret/)
  })

  it("is deterministic for the same claims + secret", async () => {
    const claims = { sub: "user-1", iat: 12345, exp: 12645 }
    const a = await signHS256(claims, SECRET)
    const b = await signHS256(claims, SECRET)
    expect(a).toBe(b)
  })

  it("yields different JWTs for different claims", async () => {
    const a = await signHS256({ sub: "user-1" }, SECRET)
    const b = await signHS256({ sub: "user-2" }, SECRET)
    expect(a).not.toBe(b)
  })
})
