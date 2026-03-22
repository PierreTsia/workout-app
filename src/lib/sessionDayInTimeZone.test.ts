import { describe, expect, it } from "vitest"
import { formatSessionDayKeyInTimeZone } from "@/lib/sessionDayInTimeZone"

describe("formatSessionDayKeyInTimeZone", () => {
  it("formats UTC midnight as the prior calendar day in America/New_York", () => {
    const key = formatSessionDayKeyInTimeZone("2024-03-15T00:00:00.000Z", "America/New_York")
    expect(key).toBe("2024-03-14")
  })

  it("formats noon UTC as 2024-03-15 in UTC", () => {
    const key = formatSessionDayKeyInTimeZone("2024-03-15T12:00:00.000Z", "UTC")
    expect(key).toBe("2024-03-15")
  })
})
