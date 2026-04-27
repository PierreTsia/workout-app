import { describe, expect, it, vi } from "vitest"
import {
  UnauthorizedError,
  classifyBearer,
  resolveAuthLogic,
  stripBearer,
  type ResolveAuthDeps,
} from "./authLogic"

type FakeClient = { tag: "fake-client"; bearer: string }

function makeDeps(
  overrides: Partial<ResolveAuthDeps<FakeClient>> = {},
): ResolveAuthDeps<FakeClient> & {
  verifyPAT: ReturnType<typeof vi.fn>
  mintInternalJWT: ReturnType<typeof vi.fn>
  bumpLastUsed: ReturnType<typeof vi.fn>
  createUserClient: ReturnType<typeof vi.fn>
} {
  return {
    verifyPAT: vi.fn(async () => null),
    mintInternalJWT: vi.fn(async (userId: string) => `minted-jwt-for-${userId}`),
    bumpLastUsed: vi.fn(async () => {}),
    createUserClient: vi.fn((authHeader: string) => ({
      tag: "fake-client" as const,
      bearer: authHeader,
    })),
    ...overrides,
  }
}

describe("stripBearer", () => {
  it("strips a `Bearer ` prefix and trims whitespace", () => {
    expect(stripBearer("Bearer glp_abc123")).toBe("glp_abc123")
  })

  it("trims surrounding whitespace inside Bearer", () => {
    expect(stripBearer("Bearer   glp_abc  ")).toBe("glp_abc")
  })

  it("returns the trimmed input when no Bearer prefix is present", () => {
    expect(stripBearer("glp_abc")).toBe("glp_abc")
    expect(stripBearer("  glp_abc  ")).toBe("glp_abc")
  })

  it("returns empty string for empty input", () => {
    expect(stripBearer("")).toBe("")
  })

  it("returns empty string for `Bearer ` with no token", () => {
    expect(stripBearer("Bearer ")).toBe("")
  })

  it("is case-sensitive (only `Bearer` with capital B is recognized)", () => {
    // RFC 6750 says the scheme is case-insensitive; we don't bother with that
    // robustness here because every MCP client emits `Bearer ` exactly. If a
    // future client sends `bearer ` we lose nothing — the entire string is
    // returned and classifyBearer routes it as "other" → OAuth path → server
    // rejects with 401 on the data query. Locking the current strict behavior.
    expect(stripBearer("bearer glp_abc")).toBe("bearer glp_abc")
  })
})

describe("classifyBearer", () => {
  it("returns 'missing' for the empty string", () => {
    expect(classifyBearer("")).toBe("missing")
  })

  it("returns 'pat' for tokens starting with glp_", () => {
    expect(classifyBearer("glp_anything")).toBe("pat")
  })

  it("returns 'other' for JWT-shaped tokens", () => {
    expect(classifyBearer("eyJhbGciOiJIUzI1NiJ9.foo.bar")).toBe("other")
  })

  it("returns 'other' for arbitrary garbage", () => {
    expect(classifyBearer("not-a-token")).toBe("other")
    expect(classifyBearer("gh_xxx")).toBe("other")
  })
})

describe("resolveAuthLogic — non-PAT path (OAuth pass-through)", () => {
  it("returns createUserClient(authHeader) unchanged for empty bearer", async () => {
    const deps = makeDeps()
    const result = await resolveAuthLogic("", deps)

    expect(deps.createUserClient).toHaveBeenCalledTimes(1)
    expect(deps.createUserClient).toHaveBeenCalledWith("")
    expect(result.bearer).toBe("")
  })

  it("returns createUserClient(authHeader) unchanged for OAuth JWT", async () => {
    const deps = makeDeps()
    const oauthHeader = "Bearer eyJhbGciOiJIUzI1NiJ9.foo.bar"
    const result = await resolveAuthLogic(oauthHeader, deps)

    expect(deps.createUserClient).toHaveBeenCalledTimes(1)
    expect(deps.createUserClient).toHaveBeenCalledWith(oauthHeader)
    expect(result.bearer).toBe(oauthHeader)
  })

  it("does NOT call verifyPAT / mintInternalJWT / bumpLastUsed on OAuth path", async () => {
    const deps = makeDeps()
    await resolveAuthLogic("Bearer eyJ.foo.bar", deps)

    expect(deps.verifyPAT).not.toHaveBeenCalled()
    expect(deps.mintInternalJWT).not.toHaveBeenCalled()
    expect(deps.bumpLastUsed).not.toHaveBeenCalled()
  })

  it("does NOT call verifyPAT / mintInternalJWT / bumpLastUsed on empty header", async () => {
    const deps = makeDeps()
    await resolveAuthLogic("", deps)

    expect(deps.verifyPAT).not.toHaveBeenCalled()
    expect(deps.mintInternalJWT).not.toHaveBeenCalled()
    expect(deps.bumpLastUsed).not.toHaveBeenCalled()
  })
})

describe("resolveAuthLogic — PAT happy path", () => {
  const PAT = "glp_4HxzKj7nMqRtY2Wp8VbN3CdFgHj5SkLm"

  it("verifyPAT receives the stripped PAT (no Bearer prefix)", async () => {
    const deps = makeDeps({
      verifyPAT: vi.fn(async () => ({ patId: "pat-1", userId: "user-1" })),
    })
    await resolveAuthLogic(`Bearer ${PAT}`, deps)

    expect(deps.verifyPAT).toHaveBeenCalledTimes(1)
    expect(deps.verifyPAT).toHaveBeenCalledWith(PAT)
  })

  it("mintInternalJWT receives the verified userId", async () => {
    const deps = makeDeps({
      verifyPAT: vi.fn(async () => ({ patId: "pat-1", userId: "user-42" })),
    })
    await resolveAuthLogic(`Bearer ${PAT}`, deps)

    expect(deps.mintInternalJWT).toHaveBeenCalledTimes(1)
    expect(deps.mintInternalJWT).toHaveBeenCalledWith("user-42")
  })

  it("createUserClient is called with `Bearer <minted-jwt>`, NOT the original PAT", async () => {
    const deps = makeDeps({
      verifyPAT: vi.fn(async () => ({ patId: "pat-1", userId: "user-1" })),
    })
    const result = await resolveAuthLogic(`Bearer ${PAT}`, deps)

    expect(deps.createUserClient).toHaveBeenCalledTimes(1)
    expect(deps.createUserClient).toHaveBeenCalledWith(
      "Bearer minted-jwt-for-user-1",
    )
    expect(result.bearer).toBe("Bearer minted-jwt-for-user-1")
    expect(result.bearer).not.toContain(PAT)
  })

  it("bumpLastUsed is fired with the verified patId", async () => {
    const deps = makeDeps({
      verifyPAT: vi.fn(async () => ({ patId: "pat-uuid-99", userId: "user-1" })),
    })
    await resolveAuthLogic(`Bearer ${PAT}`, deps)

    expect(deps.bumpLastUsed).toHaveBeenCalledTimes(1)
    expect(deps.bumpLastUsed).toHaveBeenCalledWith("pat-uuid-99")
  })

  it("works without the Bearer prefix on the input header", async () => {
    const deps = makeDeps({
      verifyPAT: vi.fn(async () => ({ patId: "pat-1", userId: "user-1" })),
    })
    await resolveAuthLogic(PAT, deps)

    expect(deps.verifyPAT).toHaveBeenCalledWith(PAT)
  })
})

describe("resolveAuthLogic — PAT verification failure", () => {
  const PAT = "glp_invalid"

  it("throws UnauthorizedError when verifyPAT returns null", async () => {
    const deps = makeDeps({ verifyPAT: vi.fn(async () => null) })

    await expect(resolveAuthLogic(`Bearer ${PAT}`, deps)).rejects.toBeInstanceOf(
      UnauthorizedError,
    )
  })

  it("UnauthorizedError carries a non-empty message (caller maps to 401 body)", async () => {
    const deps = makeDeps({ verifyPAT: vi.fn(async () => null) })

    try {
      await resolveAuthLogic(`Bearer ${PAT}`, deps)
      throw new Error("expected UnauthorizedError to be thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
      expect((err as Error).message).toMatch(/personal access token/i)
    }
  })

  it("does NOT call mintInternalJWT / bumpLastUsed / createUserClient when verifyPAT fails", async () => {
    const deps = makeDeps({ verifyPAT: vi.fn(async () => null) })

    await resolveAuthLogic(`Bearer ${PAT}`, deps).catch(() => undefined)

    expect(deps.mintInternalJWT).not.toHaveBeenCalled()
    expect(deps.bumpLastUsed).not.toHaveBeenCalled()
    expect(deps.createUserClient).not.toHaveBeenCalled()
  })
})

describe("resolveAuthLogic — bumpLastUsed must be fire-and-forget", () => {
  const PAT = "glp_validtoken"

  it("auth response is NOT gated on bumpLastUsed completion", async () => {
    let bumpResolved = false
    const slowBump = new Promise<void>((resolve) => {
      setTimeout(() => {
        bumpResolved = true
        resolve()
      }, 50)
    })

    const deps = makeDeps({
      verifyPAT: vi.fn(async () => ({ patId: "pat-1", userId: "user-1" })),
      bumpLastUsed: vi.fn(() => slowBump),
    })

    const before = Date.now()
    const result = await resolveAuthLogic(`Bearer ${PAT}`, deps)
    const elapsed = Date.now() - before

    // Auth resolved promptly even though the bump is still pending.
    expect(result.bearer).toBe("Bearer minted-jwt-for-user-1")
    expect(bumpResolved).toBe(false)
    expect(elapsed).toBeLessThan(40)

    // Drain the slow bump so the test process doesn't leak a pending timer.
    await slowBump
  })

  it("bumpLastUsed throwing async does NOT propagate to the caller", async () => {
    const deps = makeDeps({
      verifyPAT: vi.fn(async () => ({ patId: "pat-1", userId: "user-1" })),
      bumpLastUsed: vi.fn(async () => {
        throw new Error("DB blip")
      }),
    })

    const result = await resolveAuthLogic(`Bearer ${PAT}`, deps)
    expect(result.bearer).toBe("Bearer minted-jwt-for-user-1")
    // Wait a tick so the rejection has a chance to surface — it must not.
    await Promise.resolve()
    await Promise.resolve()
  })

  it("bumpLastUsed throwing synchronously does NOT propagate to the caller", async () => {
    const deps = makeDeps({
      verifyPAT: vi.fn(async () => ({ patId: "pat-1", userId: "user-1" })),
      bumpLastUsed: vi.fn(() => {
        // Synchronous throw — covers a bug where bumpLastUsed isn't async
        // and a regression makes it throw before returning a Promise.
        throw new Error("sync boom")
      }),
    })

    // resolveAuthLogic invokes bumpLastUsed and chains `.catch` on its return
    // value. If bumpLastUsed throws synchronously the chain is never built and
    // the error escapes — the test guards against that regression.
    let caught: unknown = null
    try {
      const result = await resolveAuthLogic(`Bearer ${PAT}`, deps)
      expect(result.bearer).toBe("Bearer minted-jwt-for-user-1")
    } catch (err) {
      caught = err
    }
    expect(caught).toBeNull()
  })
})
