import { describe, it, expect } from "vitest"
import { normalizeForSearch } from "./search"

describe("normalizeForSearch", () => {
  it("lowercases text", () => {
    expect(normalizeForSearch("Bench Press")).toBe("bench press")
  })

  it("strips acute accents", () => {
    expect(normalizeForSearch("Développé")).toBe("developpe")
  })

  it("strips grave accents", () => {
    expect(normalizeForSearch("À côté")).toBe("a cote")
  })

  it("strips circumflex accents", () => {
    expect(normalizeForSearch("Être côte à côte")).toBe("etre cote a cote")
  })

  it("strips cedillas", () => {
    expect(normalizeForSearch("Français")).toBe("francais")
  })

  it("strips combined diacritics", () => {
    expect(normalizeForSearch("Écarté incliné")).toBe("ecarte incline")
  })

  it("handles already-normalized text", () => {
    expect(normalizeForSearch("crunch")).toBe("crunch")
  })

  it("handles empty string", () => {
    expect(normalizeForSearch("")).toBe("")
  })

  it("preserves numbers and special characters", () => {
    expect(normalizeForSearch("Série #3 — 10kg")).toBe("serie #3 — 10kg")
  })

  it("handles umlauts", () => {
    expect(normalizeForSearch("Über")).toBe("uber")
  })

  it("handles tilde", () => {
    expect(normalizeForSearch("España")).toBe("espana")
  })
})
