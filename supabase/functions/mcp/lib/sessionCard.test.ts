import { describe, expect, it } from "vitest"

import { resolveCardLocale } from "./sessionCard.ts"

describe("resolveCardLocale", () => {
  it("prefers the explicit tool argument", () => {
    expect(resolveCardLocale("fr", "en")).toBe("fr")
    expect(resolveCardLocale("en", "fr")).toBe("en")
  })

  it("falls back to the athlete's stored locale", () => {
    expect(resolveCardLocale(undefined, "fr")).toBe("fr")
  })

  it("returns null for anything unusable, so the caller can pick a fallback", () => {
    expect(resolveCardLocale(undefined, null)).toBeNull()
    expect(resolveCardLocale("de", "es")).toBeNull()
    expect(resolveCardLocale(42, {})).toBeNull()
  })
})
