import { describe, expect, it } from "vitest"
import { createTestI18n } from "@/test/utils"
import { formatFactsLine } from "./formatFactsLine"

describe("formatFactsLine", () => {
  it("pluralizes each fact independently", () => {
    const t = createTestI18n().getFixedT("en", "program")
    expect(
      formatFactsLine(t, { dayCount: 3, setCount: 24, circuitCount: 1 }),
    ).toBe("3 days · 24 sets · 1 circuit")
    expect(
      formatFactsLine(t, { dayCount: 1, setCount: 1, circuitCount: 0 }),
    ).toBe("1 day · 1 set · 0 circuits")
  })

  it("keeps the French compact day unit", () => {
    const t = createTestI18n({ lng: "fr" }).getFixedT("fr", "program")
    expect(
      formatFactsLine(t, { dayCount: 3, setCount: 24, circuitCount: 1 }),
    ).toBe("3 j · 24 séries · 1 circuit")
  })
})
