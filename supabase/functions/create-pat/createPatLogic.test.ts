import { describe, expect, it } from "vitest"
import {
  PAT_NAME_MAX_LENGTH,
  PAT_QUOTA,
  checkJWTNotPATDerived,
  computeExpiresAt,
  validateCreatePATBody,
} from "./createPatLogic"

const encoder = new TextEncoder()

function base64urlEncode(bytes: Uint8Array): string {
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("")
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function makeJWT(payload: Record<string, unknown>, signature = "fake-sig"): string {
  const header = base64urlEncode(
    encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  )
  const body = base64urlEncode(encoder.encode(JSON.stringify(payload)))
  return `${header}.${body}.${signature}`
}

describe("validateCreatePATBody", () => {
  describe("body shape", () => {
    it.each([null, undefined, 42, "string", [], true])(
      "rejects non-object input: %p",
      (input) => {
        const result = validateCreatePATBody(input)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.status).toBe(400)
          expect(result.body.error).toMatch(/JSON object/i)
        }
      },
    )
  })

  describe("name validation", () => {
    it("rejects when name is missing", () => {
      const r = validateCreatePATBody({ lifetime_days: 90 })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.body.field).toBe("name")
        expect(r.body.error).toMatch(/string/i)
      }
    })

    it("rejects when name is not a string", () => {
      const r = validateCreatePATBody({ name: 42, lifetime_days: 90 })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.body.field).toBe("name")
    })

    it("rejects when trimmed name is empty", () => {
      const r = validateCreatePATBody({ name: "   ", lifetime_days: 90 })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.body.field).toBe("name")
        expect(r.body.error).toMatch(/empty/i)
      }
    })

    it("rejects when name exceeds the max length", () => {
      const r = validateCreatePATBody({
        name: "x".repeat(PAT_NAME_MAX_LENGTH + 1),
        lifetime_days: 90,
      })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.body.field).toBe("name")
        expect(r.body.error).toMatch(/64/)
      }
    })

    it("trims surrounding whitespace before storing", () => {
      const r = validateCreatePATBody({
        name: "  Cursor laptop  ",
        lifetime_days: 90,
      })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.value.name).toBe("Cursor laptop")
    })

    it("accepts a name of exactly the max length", () => {
      const r = validateCreatePATBody({
        name: "x".repeat(PAT_NAME_MAX_LENGTH),
        lifetime_days: 90,
      })
      expect(r.ok).toBe(true)
    })

    it("accepts a single-character name", () => {
      const r = validateCreatePATBody({ name: "x", lifetime_days: 90 })
      expect(r.ok).toBe(true)
    })
  })

  describe("lifetime_days validation", () => {
    it.each([30, 90, 365, null])(
      "accepts the valid value %p",
      (lifetime) => {
        const r = validateCreatePATBody({ name: "ok", lifetime_days: lifetime })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.value.lifetime_days).toBe(lifetime)
      },
    )

    it.each([0, 7, 60, 100, 365.5, "30", true, undefined, [], {}])(
      "rejects the invalid value %p",
      (lifetime) => {
        const r = validateCreatePATBody({ name: "ok", lifetime_days: lifetime })
        expect(r.ok).toBe(false)
        if (!r.ok) {
          expect(r.body.field).toBe("lifetime_days")
          expect(r.body.error).toMatch(/30, 90, 365.*null/)
        }
      },
    )

    it("requires lifetime_days to be sent explicitly (no default)", () => {
      const r = validateCreatePATBody({ name: "ok" })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.body.field).toBe("lifetime_days")
    })
  })

  it("returns the canonical { name, lifetime_days } shape on success", () => {
    const r = validateCreatePATBody({ name: "Cursor", lifetime_days: 365 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toEqual({ name: "Cursor", lifetime_days: 365 })
    }
  })
})

describe("checkJWTNotPATDerived", () => {
  it("returns ok for a JWT without aal claim", () => {
    const jwt = makeJWT({ sub: "user-1", role: "authenticated" })
    expect(checkJWTNotPATDerived(jwt)).toEqual({ ok: true })
  })

  it("returns ok for a JWT with aal=aal1 (standard browser session)", () => {
    const jwt = makeJWT({ sub: "user-1", aal: "aal1" })
    expect(checkJWTNotPATDerived(jwt)).toEqual({ ok: true })
  })

  it("returns ok for a JWT with aal=aal2 (MFA session)", () => {
    const jwt = makeJWT({ sub: "user-1", aal: "aal2" })
    expect(checkJWTNotPATDerived(jwt)).toEqual({ ok: true })
  })

  it("rejects a JWT with aal=pat (PAT-derived) — anti-escalation invariant", () => {
    // This is THE security-critical test. If this ever returns ok, a PAT
    // holder could mint additional PATs — defeating the entire model.
    const jwt = makeJWT({ sub: "user-1", aal: "pat" })
    expect(checkJWTNotPATDerived(jwt)).toEqual({
      ok: false,
      reason: "pat-derived",
    })
  })

  it("returns malformed for non-3-part strings", () => {
    expect(checkJWTNotPATDerived("not.a.jwt.at.all")).toEqual({
      ok: false,
      reason: "malformed",
    })
    expect(checkJWTNotPATDerived("only-two.parts")).toEqual({
      ok: false,
      reason: "malformed",
    })
    expect(checkJWTNotPATDerived("single")).toEqual({
      ok: false,
      reason: "malformed",
    })
    expect(checkJWTNotPATDerived("")).toEqual({
      ok: false,
      reason: "malformed",
    })
  })

  it("returns malformed when the payload is not valid base64url", () => {
    expect(checkJWTNotPATDerived("header.!!!invalid!!!.sig")).toEqual({
      ok: false,
      reason: "malformed",
    })
  })

  it("returns malformed when the payload is not valid JSON", () => {
    const fakePayload = base64urlEncode(encoder.encode("not-json"))
    expect(checkJWTNotPATDerived(`header.${fakePayload}.sig`)).toEqual({
      ok: false,
      reason: "malformed",
    })
  })

  it("treats other aal values as ok (e.g. future Supabase additions)", () => {
    const jwt = makeJWT({ sub: "user-1", aal: "something-future" })
    expect(checkJWTNotPATDerived(jwt)).toEqual({ ok: true })
  })
})

describe("computeExpiresAt", () => {
  it("returns null for the never-expires lifetime", () => {
    expect(computeExpiresAt(null)).toBeNull()
  })

  it.each([
    [30, 30 * 86_400],
    [90, 90 * 86_400],
    [365, 365 * 86_400],
  ])("returns now + %d days for lifetime %p", (lifetime, expectedSeconds) => {
    const now = new Date("2026-04-27T12:00:00Z")
    const result = computeExpiresAt(lifetime as 30 | 90 | 365, now)
    expect(result).not.toBeNull()
    const elapsed = (Date.parse(result!) - now.getTime()) / 1000
    expect(elapsed).toBe(expectedSeconds)
  })

  it("uses the current date when `now` is omitted", () => {
    const before = Date.now()
    const result = computeExpiresAt(30)
    const after = Date.now()
    expect(result).not.toBeNull()
    const ts = Date.parse(result!)
    expect(ts).toBeGreaterThanOrEqual(before + 30 * 86_400 * 1000 - 50)
    expect(ts).toBeLessThanOrEqual(after + 30 * 86_400 * 1000 + 50)
  })

  it("returns an ISO 8601 string with millisecond precision", () => {
    const result = computeExpiresAt(30, new Date("2026-04-27T12:00:00Z"))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})

describe("constants", () => {
  it("PAT_QUOTA stays at 10 (decision locked in epic + tech plan)", () => {
    // If this test fails, the change is intentional but the brief and tech
    // plan need updating in the same commit.
    expect(PAT_QUOTA).toBe(10)
  })
})
