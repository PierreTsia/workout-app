import { describe, expect, it } from "vitest"
import { mintInternalJWT, verifyPATAgainstDB } from "./pat"

const encoder = new TextEncoder()

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function decodeClaims<T>(jwt: string): T {
  return JSON.parse(new TextDecoder().decode(base64urlDecode(jwt.split(".")[1]))) as T
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

type InternalClaims = {
  sub: string
  role: string
  aud: string
  iss: string
  iat: number
  exp: number
  aal: string
}

describe("mintInternalJWT", () => {
  const CONFIG = {
    jwtSecret: "test-jwt-secret",
    supabaseUrl: "https://test.supabase.co",
  }

  it("returns a signed HS256 JWT verifiable with the same secret", async () => {
    const jwt = await mintInternalJWT("user-1", CONFIG)
    expect(await verifyHS256(jwt, CONFIG.jwtSecret)).toBe(true)
  })

  it("emits the canonical Supabase Auth claim shape + aal=pat", async () => {
    const jwt = await mintInternalJWT("user-42", CONFIG)
    const claims = decodeClaims<InternalClaims>(jwt)
    expect(claims.sub).toBe("user-42")
    expect(claims.role).toBe("authenticated")
    expect(claims.aud).toBe("authenticated")
    expect(claims.iss).toBe(`${CONFIG.supabaseUrl}/auth/v1`)
    expect(claims.aal).toBe("pat")
  })

  it("uses a 5-minute TTL by default", async () => {
    const jwt = await mintInternalJWT("user-1", CONFIG)
    const claims = decodeClaims<InternalClaims>(jwt)
    expect(claims.exp - claims.iat).toBe(300)
  })

  it("respects a custom ttlSeconds override", async () => {
    const jwt = await mintInternalJWT("user-1", { ...CONFIG, ttlSeconds: 60 })
    const claims = decodeClaims<InternalClaims>(jwt)
    expect(claims.exp - claims.iat).toBe(60)
  })

  it("sets iat near the current time", async () => {
    const before = Math.floor(Date.now() / 1000)
    const jwt = await mintInternalJWT("user-1", CONFIG)
    const after = Math.floor(Date.now() / 1000)
    const claims = decodeClaims<InternalClaims>(jwt)
    expect(claims.iat).toBeGreaterThanOrEqual(before)
    expect(claims.iat).toBeLessThanOrEqual(after)
  })

  it("rejects an empty jwtSecret", async () => {
    await expect(
      mintInternalJWT("user-1", { ...CONFIG, jwtSecret: "" }),
    ).rejects.toThrow(/jwtSecret/)
  })

  it("rejects an empty userId", async () => {
    await expect(mintInternalJWT("", CONFIG)).rejects.toThrow(/userId/)
  })

  it("does NOT verify with a different secret", async () => {
    const jwt = await mintInternalJWT("user-1", CONFIG)
    expect(await verifyHS256(jwt, "wrong-secret")).toBe(false)
  })
})

describe("verifyPATAgainstDB", () => {
  it("returns null and skips the DB on inputs not starting with glp_", async () => {
    // Proxy throws on any property access — proves the function never touches
    // the supabase client when the prefix check fails.
    const throwingClient = new Proxy(
      {},
      {
        get() {
          throw new Error("DB should not be called for malformed PAT input")
        },
      },
    ) as never

    expect(
      await verifyPATAgainstDB("eyJhbGciOiJIUzI1NiJ9.foo.bar", {
        pepper: "p",
        supabase: throwingClient,
      }),
    ).toBeNull()

    expect(
      await verifyPATAgainstDB("not-a-token", {
        pepper: "p",
        supabase: throwingClient,
      }),
    ).toBeNull()

    expect(
      await verifyPATAgainstDB("", { pepper: "p", supabase: throwingClient }),
    ).toBeNull()
  })

  it("returns null when the DB returns no row", async () => {
    const stubClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            or: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
        update: () => ({ eq: () => ({ or: () => Promise.resolve({ data: null, error: null }) }) }),
      }),
    }
    const result = await verifyPATAgainstDB("glp_nonexistent", {
      pepper: "test-pepper",
      supabase: stubClient,
    })
    expect(result).toBeNull()
  })

  it("returns null and logs when the DB returns an error", async () => {
    const stubClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            or: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: { message: "boom" } }),
            }),
          }),
        }),
        update: () => ({ eq: () => ({ or: () => Promise.resolve({ data: null, error: null }) }) }),
      }),
    }
    const result = await verifyPATAgainstDB("glp_token", {
      pepper: "test-pepper",
      supabase: stubClient,
    })
    expect(result).toBeNull()
  })

  it("returns { patId, userId } when the DB returns a row", async () => {
    const stubClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            or: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "pat-uuid-123", user_id: "user-uuid-456" },
                  error: null,
                }),
            }),
          }),
        }),
        update: () => ({ eq: () => ({ or: () => Promise.resolve({ data: null, error: null }) }) }),
      }),
    }
    const result = await verifyPATAgainstDB("glp_validtoken", {
      pepper: "test-pepper",
      supabase: stubClient,
    })
    expect(result).toEqual({ patId: "pat-uuid-123", userId: "user-uuid-456" })
  })
})
