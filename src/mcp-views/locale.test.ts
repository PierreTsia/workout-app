import { describe, expect, it } from "vitest"

import { normalizeLocale, preservePreviewLocale, resolveViewLocale } from "./locale"

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
  it("prefers the explicit tool argument above everything", () => {
    expect(resolveViewLocale("fr", "en-US", "en")).toBe("fr")
    expect(resolveViewLocale("en", "fr-FR", "fr")).toBe("en")
  })

  it("ranks the host locale above the profile seed (Display Locale)", () => {
    expect(resolveViewLocale(undefined, "fr-FR", "en")).toBe("fr")
    expect(resolveViewLocale(null, "en-GB", "fr")).toBe("en")
  })

  it("falls back to the profile seed when the host carries none", () => {
    expect(resolveViewLocale(undefined, undefined, "fr")).toBe("fr")
  })

  it("defaults to English when no source is usable", () => {
    expect(resolveViewLocale(undefined, undefined, undefined)).toBe("en")
    expect(resolveViewLocale("de", "es", "it")).toBe("en")
  })
})

describe("preservePreviewLocale", () => {
  it("keeps the preview's locale metadata when the Apply response omits it", () => {
    const applied = preservePreviewLocale(
      { status: "applied" },
      { locale: "fr", profile_locale: "fr" },
    )
    expect(applied.locale).toBe("fr")
    expect(applied.profile_locale).toBe("fr")
  })

  it("never overrides locale metadata the Apply response does carry", () => {
    const applied = preservePreviewLocale({ status: "applied", locale: "en" }, { locale: "fr" })
    expect(applied.locale).toBe("en")
  })

  it("lets a fresh preview through untouched so the example's English never leaks", () => {
    const preview = preservePreviewLocale(
      { status: "preview" },
      { locale: "en" },
    )
    expect(preview.locale).toBeUndefined()
    expect(preview.profile_locale).toBeUndefined()
  })
})
