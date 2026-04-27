import { describe, expect, it } from "vitest"
import {
  PAT_BODY_LENGTH,
  PAT_DISPLAY_PREFIX_LENGTH,
  PAT_PREFIX,
  PAT_TOTAL_LENGTH,
  extractPrefix,
  generatePAT,
  hashPAT,
  isPATFormat,
} from "./patFormat"

const BASE58_ALPHABET_REGEX =
  /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/

describe("generatePAT", () => {
  it("produces a string of the expected total length", () => {
    const pat = generatePAT()
    expect(pat.length).toBe(PAT_TOTAL_LENGTH)
  })

  it("starts with the glp_ prefix", () => {
    expect(generatePAT().startsWith(PAT_PREFIX)).toBe(true)
  })

  it("uses only base58 characters in the body (no 0/O/1/l/I)", () => {
    const body = generatePAT().slice(PAT_PREFIX.length)
    expect(body).toMatch(BASE58_ALPHABET_REGEX)
    expect(body.length).toBe(PAT_BODY_LENGTH)
    expect(body).not.toMatch(/[0O1lI]/)
  })

  it("returns unique values across many calls", () => {
    const samples = new Set(Array.from({ length: 1000 }, () => generatePAT()))
    expect(samples.size).toBe(1000)
  })

  it("produces sufficiently varied bodies (sanity check on entropy)", () => {
    // With 187 bits of entropy and the base58 alphabet of 58 chars, we expect
    // most of the alphabet to appear at least once across 100 samples.
    const allChars = Array.from({ length: 100 }, () => generatePAT())
      .map((p) => p.slice(PAT_PREFIX.length))
      .join("")
    const distinct = new Set(allChars).size
    // Loose lower bound — flakes only if entropy collapses entirely.
    expect(distinct).toBeGreaterThan(40)
  })
})

describe("hashPAT", () => {
  const PEPPER = "test-pepper-do-not-use-in-prod"

  it("returns a 64-char lowercase hex string", async () => {
    const hash = await hashPAT("glp_abc123", PEPPER)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is deterministic for the same input + pepper", async () => {
    const a = await hashPAT("glp_abc123", PEPPER)
    const b = await hashPAT("glp_abc123", PEPPER)
    expect(a).toBe(b)
  })

  it("yields different hashes for different plaintexts", async () => {
    const a = await hashPAT("glp_abc123", PEPPER)
    const b = await hashPAT("glp_abc124", PEPPER)
    expect(a).not.toBe(b)
  })

  it("yields different hashes for different peppers", async () => {
    const a = await hashPAT("glp_abc123", PEPPER)
    const b = await hashPAT("glp_abc123", "different-pepper")
    expect(a).not.toBe(b)
  })

  it("hashes the full plaintext including the glp_ prefix", async () => {
    // A consumer that accidentally stripped the prefix at verify time would
    // produce a different hash than the create-time hash. Lock that in.
    const withPrefix = await hashPAT("glp_abc123", PEPPER)
    const withoutPrefix = await hashPAT("abc123", PEPPER)
    expect(withPrefix).not.toBe(withoutPrefix)
  })

  it("rejects an empty pepper", async () => {
    await expect(hashPAT("glp_abc123", "")).rejects.toThrow(/pepper/)
  })

  it("hashes the actual generatePAT output round-trip", async () => {
    const pat = generatePAT()
    const hash = await hashPAT(pat, PEPPER)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashPAT(pat, PEPPER)).toBe(hash)
  })
})

describe("extractPrefix", () => {
  it("returns the first PAT_DISPLAY_PREFIX_LENGTH chars", () => {
    const pat = "glp_4HxzKj7nMqRtY2Wp8VbN3CdFgHj5SkLm"
    const prefix = extractPrefix(pat)
    expect(prefix).toBe(pat.slice(0, PAT_DISPLAY_PREFIX_LENGTH))
    expect(prefix.length).toBe(PAT_DISPLAY_PREFIX_LENGTH)
    expect(prefix.startsWith(PAT_PREFIX)).toBe(true)
  })

  it("works against generatePAT output", () => {
    const pat = generatePAT()
    expect(extractPrefix(pat)).toBe(pat.slice(0, PAT_DISPLAY_PREFIX_LENGTH))
  })

  it("throws when the input does not start with glp_", () => {
    expect(() => extractPrefix("eyJhbGciOiJIUzI1NiJ9.foo")).toThrow(/glp_/)
  })

  it("throws when the input is shorter than the display prefix length", () => {
    expect(() => extractPrefix("glp_")).toThrow(/shorter/)
  })
})

describe("isPATFormat", () => {
  it("returns true for strings with the glp_ prefix", () => {
    expect(isPATFormat("glp_anything")).toBe(true)
    expect(isPATFormat(generatePAT())).toBe(true)
  })

  it("returns false for strings without the glp_ prefix", () => {
    expect(isPATFormat("eyJhbGciOiJIUzI1NiJ9.foo.bar")).toBe(false)
    expect(isPATFormat("Bearer glp_abc")).toBe(false) // caller is expected to strip
    expect(isPATFormat("")).toBe(false)
    expect(isPATFormat("gh_abc123")).toBe(false)
  })
})
