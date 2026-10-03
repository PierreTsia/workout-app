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

  it("defaults to English for anything unusable", () => {
    expect(resolveCardLocale(undefined, null)).toBe("en")
    expect(resolveCardLocale("de", "es")).toBe("en")
    expect(resolveCardLocale(42, {})).toBe("en")
  })
})
