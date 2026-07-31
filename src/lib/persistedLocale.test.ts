import { afterEach, describe, expect, it } from "vitest"
import {
  detectLocale,
  normalizeLocale,
  readPersistedLocale,
} from "./persistedLocale"

afterEach(() => {
  localStorage.clear()
})

describe("normalizeLocale", () => {
  // `user_profiles.locale` has a CHECK on ('en','fr'): writing the raw
  // `i18n.language` would be rejected for every browser that reports a region.
  it.each(["en-US", "en-GB", "EN"])("strips the region from %s", (tag) => {
    expect(normalizeLocale(tag)).toBe("en")
  })

  it("keeps a bare supported tag", () => {
    expect(normalizeLocale("fr")).toBe("fr")
  })

  it.each(["es", "de-DE", "", null, undefined])(
    "returns null for %s",
    (tag) => {
      expect(normalizeLocale(tag)).toBeNull()
    },
  )
})

describe("detectLocale", () => {
  it("follows the browser when it speaks a supported language", () => {
    expect(detectLocale("fr-CA")).toBe("fr")
  })

  // Matches `fallbackLng` in i18n.ts. The previous default was French, which
  // contradicted it.
  it("falls back to English, not French, for an unsupported language", () => {
    expect(detectLocale("de-DE")).toBe("en")
  })
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
