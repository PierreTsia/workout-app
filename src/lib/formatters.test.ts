import { describe, expect, it } from "vitest"
import { formatDurationShort } from "./formatters"

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
