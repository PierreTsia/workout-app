import { describe, expect, it, vi } from "vitest"
import { hashPAT } from "../../_shared/patFormat"
import {
  bumpLastUsedIfStale,
  mintInternalJWT,
  verifyPATAgainstDB,
} from "./pat"

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

  it("queries `personal_access_tokens` filtered by hashPAT(token, pepper)", async () => {
    // The single most important regression guard: if the lookup ever stops
    // computing the hash from the same plaintext + pepper that create-pat
    // will use, every PAT becomes silently unverifiable.
    const PAT = "glp_4HxzKj7nMqRtY2Wp8VbN3CdFgHj5SkLm"
    const PEPPER = "test-pepper"
    const expectedHash = await hashPAT(PAT, PEPPER)

    const fromSpy = vi.fn()
    const eqSpy = vi.fn()
    const orSpy = vi.fn()
    const stubClient = {
      from: (table: string) => {
        fromSpy(table)
        return {
          select: (cols: string) => ({
            eq: (col: string, val: string) => {
              eqSpy(col, val)
              return {
                or: (filter: string) => {
                  orSpy(filter)
                  return {
                    maybeSingle: () =>
                      Promise.resolve({
                        data: { id: "pat-1", user_id: "user-1" },
                        error: null,
                      }),
                  }
                },
              }
            },
            // Reference cols so TS doesn't complain about unused param.
            _cols: cols,
          }),
          update: () => ({
            eq: () => ({ or: () => Promise.resolve({ data: null, error: null }) }),
          }),
        }
      },
    }

    await verifyPATAgainstDB(PAT, { pepper: PEPPER, supabase: stubClient })

    expect(fromSpy).toHaveBeenCalledWith("personal_access_tokens")
    expect(eqSpy).toHaveBeenCalledWith("token_hash", expectedHash)
    // Expiry filter must be applied server-side.
    expect(orSpy).toHaveBeenCalledTimes(1)
    expect(orSpy.mock.calls[0][0]).toMatch(/expires_at\.is\.null/)
    expect(orSpy.mock.calls[0][0]).toMatch(/expires_at\.gt\./)
  })
})

describe("bumpLastUsedIfStale", () => {
  function makeStubClient(
    spies: { update?: ReturnType<typeof vi.fn>; eq?: ReturnType<typeof vi.fn>; or?: ReturnType<typeof vi.fn> } = {},
    result: { data: unknown; error: unknown } = { data: null, error: null },
  ) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            or: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          spies.update?.(patch)
          return {
            eq: (col: string, val: string) => {
              spies.eq?.(col, val)
              return {
                or: (filter: string) => {
                  spies.or?.(filter)
                  return Promise.resolve(result)
                },
              }
            },
          }
        },
      }),
    }
  }

  it("issues UPDATE personal_access_tokens with last_used_at = <now ISO>", async () => {
    const updateSpy = vi.fn()
    const before = Date.now()
    await bumpLastUsedIfStale("pat-1", makeStubClient({ update: updateSpy }))
    const after = Date.now()

    expect(updateSpy).toHaveBeenCalledTimes(1)
    const patch = updateSpy.mock.calls[0][0] as { last_used_at: string }
    expect(patch).toHaveProperty("last_used_at")
    const ts = Date.parse(patch.last_used_at)
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it("filters by id = patId", async () => {
    const eqSpy = vi.fn()
    await bumpLastUsedIfStale("pat-uuid-99", makeStubClient({ eq: eqSpy }))

    expect(eqSpy).toHaveBeenCalledWith("id", "pat-uuid-99")
  })

  it("applies the write-if-stale predicate (last_used_at IS NULL OR < threshold)", async () => {
    const orSpy = vi.fn()
    const before = Date.now()
    await bumpLastUsedIfStale("pat-1", makeStubClient({ or: orSpy }), 60)

    expect(orSpy).toHaveBeenCalledTimes(1)
    const filter = orSpy.mock.calls[0][0] as string
    expect(filter).toMatch(/last_used_at\.is\.null/)
    expect(filter).toMatch(/last_used_at\.lt\./)

    // Threshold should be ~60 seconds before now (within a few hundred ms).
    const ltMatch = filter.match(/last_used_at\.lt\.([^,]+)/)
    expect(ltMatch).not.toBeNull()
    const thresholdTs = Date.parse(ltMatch![1])
    expect(before - 60_000 - 500).toBeLessThan(thresholdTs)
    expect(thresholdTs).toBeLessThan(before - 60_000 + 500)
  })

  it("respects a custom thresholdSeconds override", async () => {
    const orSpy = vi.fn()
    const before = Date.now()
    await bumpLastUsedIfStale("pat-1", makeStubClient({ or: orSpy }), 5)

    const filter = orSpy.mock.calls[0][0] as string
    const ltMatch = filter.match(/last_used_at\.lt\.([^,]+)/)
    const thresholdTs = Date.parse(ltMatch![1])
    expect(before - 5_000 - 500).toBeLessThan(thresholdTs)
    expect(thresholdTs).toBeLessThan(before - 5_000 + 500)
  })

  it("returns void (does NOT throw) when the DB returns an error", async () => {
    const client = makeStubClient({}, { data: null, error: { message: "boom" } })
    // Must NOT reject. Auth path depends on this — bump failure is logged
    // and swallowed, never propagated.
    await expect(bumpLastUsedIfStale("pat-1", client)).resolves.toBeUndefined()
  })

  it("does NOT throw when the DB chain rejects with a runtime exception", async () => {
    // Contract guard: bumpLastUsedIfStale must NEVER throw. Auth latency
    // tolerance and the fire-and-forget design depend on this — a regression
    // here that lets exceptions escape would surface as auth-path failures
    // when the DB blips.
    const throwingClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            or: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            or: () => Promise.reject(new Error("network down")),
          }),
        }),
      }),
    }
    await expect(
      bumpLastUsedIfStale("pat-1", throwingClient),
    ).resolves.toBeUndefined()
  })
})
