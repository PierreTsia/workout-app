import { describe, expect, it, vi, afterEach } from "vitest"
import { formatRelativeDate, formatDuration } from "@/lib/formatters"

describe("formatRelativeDate", () => {
  afterEach(() => vi.useRealTimers())

  it('returns "Today" for a timestamp from earlier today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-20T18:00:00Z"))
    expect(formatRelativeDate("2026-03-20T10:00:00Z", "en")).toBe("Today")
  })

  it('returns "Yesterday" for a timestamp from one day ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-20T18:00:00Z"))
    expect(formatRelativeDate("2026-03-19T10:00:00Z", "en")).toBe("Yesterday")
  })

  it("returns capitalized relative days for 2–6 days", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-20T18:00:00Z"))
    expect(formatRelativeDate("2026-03-17T10:00:00Z", "en")).toBe("3 days ago")
    expect(formatRelativeDate("2026-03-15T10:00:00Z", "en")).toBe("5 days ago")
  })

  it("returns capitalized relative weeks for 7+ days", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-20T18:00:00Z"))
    expect(formatRelativeDate("2026-03-06T10:00:00Z", "en")).toBe("2 weeks ago")
    expect(formatRelativeDate("2026-02-20T10:00:00Z", "en")).toBe("4 weeks ago")
  })

  it("capitalizes French output", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-20T18:00:00Z"))
    expect(formatRelativeDate("2026-03-20T10:00:00Z", "fr")).toContain("Aujourd")
    expect(formatRelativeDate("2026-03-19T10:00:00Z", "fr")).toBe("Hier")
    expect(formatRelativeDate("2026-03-17T10:00:00Z", "fr")).toContain("3 jours")
    expect(formatRelativeDate("2026-03-06T10:00:00Z", "fr")).toContain("2 semaines")
  })
})

describe("formatDuration", () => {
  it("formats sub-hour durations as minutes", () => {
    expect(
      formatDuration("2026-03-20T10:00:00Z", "2026-03-20T10:42:00Z"),
    ).toBe("42 min")
  })

  it("formats zero duration", () => {
    expect(
      formatDuration("2026-03-20T10:00:00Z", "2026-03-20T10:00:00Z"),
    ).toBe("0 min")
  })

  it("formats exactly one hour", () => {
    expect(
      formatDuration("2026-03-20T10:00:00Z", "2026-03-20T11:00:00Z"),
    ).toBe("1h")
  })

  it("formats hours and minutes with zero-padded minutes", () => {
    expect(
      formatDuration("2026-03-20T10:00:00Z", "2026-03-20T11:05:00Z"),
    ).toBe("1h05")
  })

  it("formats longer sessions", () => {
    expect(
      formatDuration("2026-03-20T10:00:00Z", "2026-03-20T12:30:00Z"),
    ).toBe("2h30")
  })

  it("rounds to nearest minute", () => {
    expect(
      formatDuration("2026-03-20T10:00:00Z", "2026-03-20T10:00:45Z"),
    ).toBe("1 min")
  })
})
