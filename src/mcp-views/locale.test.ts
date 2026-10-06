import { describe, expect, it } from "vitest"

import { normalizeLocale, resolveViewLocale } from "./locale"

describe("normalizeLocale", () => {
  it("maps a BCP-47 tag to its supported base locale", () => {
    expect(normalizeLocale("fr")).toBe("fr")
    expect(normalizeLocale("fr-FR")).toBe("fr")
    expect(normalizeLocale("en-US")).toBe("en")
    expect(normalizeLocale("EN")).toBe("en")
  })

  it("returns null for anything unsupported or absent", () => {
    expect(normalizeLocale("de-DE")).toBeNull()
    expect(normalizeLocale(null)).toBeNull()
    expect(normalizeLocale(undefined)).toBeNull()
  })
})

describe("resolveViewLocale", () => {
  it("prefers the payload locale (explicit arg or profile seed)", () => {
    expect(resolveViewLocale("fr", "en-US")).toBe("fr")
    expect(resolveViewLocale("en", "fr-FR")).toBe("en")
  })

  it("falls back to the host locale when the payload carries none", () => {
    expect(resolveViewLocale(undefined, "fr-FR")).toBe("fr")
    expect(resolveViewLocale(null, "en-GB")).toBe("en")
  })

  it("defaults to English when neither source is usable", () => {
    expect(resolveViewLocale(undefined, undefined)).toBe("en")
    expect(resolveViewLocale("de", "es")).toBe("en")
  })
})
