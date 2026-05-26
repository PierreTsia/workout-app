import { describe, expect, it } from "vitest"
import { formatCompactNumber, formatDurationShort } from "./formatters"

describe("formatDurationShort", () => {
  it("formats seconds-only values", () => {
    expect(formatDurationShort(30)).toBe("30s")
    expect(formatDurationShort(5)).toBe("5s")
    expect(formatDurationShort(59)).toBe("59s")
  })

  it("formats full minutes", () => {
    expect(formatDurationShort(60)).toBe("1m")
    expect(formatDurationShort(120)).toBe("2m")
  })

  it("formats minutes and seconds", () => {
    expect(formatDurationShort(90)).toBe("1m30s")
    expect(formatDurationShort(65)).toBe("1m05s")
  })

  it("handles zero", () => {
    expect(formatDurationShort(0)).toBe("0s")
  })

  it("handles negative values by clamping to 0", () => {
    expect(formatDurationShort(-10)).toBe("0s")
  })
})

describe("formatCompactNumber", () => {
  it("compacts six-digit values with one decimal in en", () => {
    expect(formatCompactNumber(288566, "en")).toBe("288.6K")
  })

  it("keeps values below 10k exact and locale-formatted", () => {
    expect(formatCompactNumber(5000, "en")).toBe("5,000")
    expect(formatCompactNumber(9999, "en")).toBe("9,999")
  })

  it("uses the FR convention for compact units (lowercase k, no-break space)", () => {
    // `\u00A0` = no-break space, what ICU emits for fr-FR compact notation
    expect(formatCompactNumber(288566, "fr")).toBe("288,6\u00A0k")
  })

  it("compacts million-scale values with one decimal to keep granularity", () => {
    expect(formatCompactNumber(1_234_567, "en")).toBe("1.2M")
    expect(formatCompactNumber(5_000_000, "en")).toBe("5M")
  })
})
