import { describe, expect, it } from "vitest"
import { weekStartsOnForLanguage } from "./weekStartsOnForLanguage"

describe("weekStartsOnForLanguage", () => {
  it("uses Sunday for en-US", () => {
    expect(weekStartsOnForLanguage("en-US")).toBe(0)
  })

  it("uses Monday for fr-FR", () => {
    expect(weekStartsOnForLanguage("fr-FR")).toBe(1)
  })
})
