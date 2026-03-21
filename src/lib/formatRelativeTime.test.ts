import { afterEach, describe, expect, it, vi } from "vitest"
import { formatRelativeTime } from "./formatRelativeTime"

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("formats past date in English", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"))
    const s = formatRelativeTime("2025-06-13T12:00:00.000Z", "en")
    expect(s.toLowerCase()).toMatch(/2|two/)
    expect(s.toLowerCase()).toMatch(/day/)
  })

  it("accepts French locale prefix", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"))
    const s = formatRelativeTime("2025-06-13T12:00:00.000Z", "fr")
    expect(s.length).toBeGreaterThan(2)
  })

  it("returns empty string for invalid ISO", () => {
    expect(formatRelativeTime("not-a-date", "en")).toBe("")
  })
})
