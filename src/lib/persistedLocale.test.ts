import { afterEach, describe, expect, it } from "vitest"
import { readPersistedLocale } from "./persistedLocale"

afterEach(() => {
  localStorage.clear()
})

describe("readPersistedLocale", () => {
  it("decodes a jotai-encoded value (JSON.stringify-ed) into the bare language code", () => {
    // jotai's `atomWithStorage` writes `JSON.stringify("fr")` → '"fr"'.
    // Without this bridge the i18next LanguageDetector reads the raw
    // value, fails to match supportedLngs, and falls back to navigator.
    localStorage.setItem("locale", '"fr"')
    expect(readPersistedLocale(localStorage)).toBe("fr")
  })

  it("decodes jotai-encoded 'en' the same way (regression: don't only special-case fr)", () => {
    localStorage.setItem("locale", '"en"')
    expect(readPersistedLocale(localStorage)).toBe("en")
  })

  it("accepts a raw string value too (DevTools-set or migrated from older versions)", () => {
    localStorage.setItem("locale", "fr")
    expect(readPersistedLocale(localStorage)).toBe("fr")
  })

  it("returns null when the key is missing (genuinely fresh user → caller should fall through to navigator detection)", () => {
    expect(readPersistedLocale(localStorage)).toBeNull()
  })

  it("returns null when the stored value is corrupt JSON (don't crash on a malformed cookie)", () => {
    localStorage.setItem("locale", "{not-json")
    expect(readPersistedLocale(localStorage)).toBeNull()
  })

  it("returns null for unsupported language codes ('es', 'de', etc.)", () => {
    localStorage.setItem("locale", '"es"')
    expect(readPersistedLocale(localStorage)).toBeNull()
  })

  it("returns null when localStorage access throws (private mode, sandboxed iframe)", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("SecurityError")
      },
    } as unknown as Storage
    expect(readPersistedLocale(throwingStorage)).toBeNull()
  })
})
