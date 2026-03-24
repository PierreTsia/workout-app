import { describe, expect, it } from "vitest"
import { formatSessionRowDuration } from "@/lib/sessionRowDuration"

describe("formatSessionRowDuration", () => {
  it("uses active_duration_ms when provided", () => {
    expect(
      formatSessionRowDuration(
        "2026-03-20T10:00:00Z",
        "2026-03-20T11:00:00Z",
        45 * 60_000,
      ),
    ).toBe("45m")
  })

  it("falls back to wall clock when active_duration_ms is null", () => {
    expect(
      formatSessionRowDuration(
        "2026-03-20T10:00:00Z",
        "2026-03-20T11:05:00Z",
        null,
      ),
    ).toBe("1h 5m")
  })

  it("returns en dash when finished_at is null", () => {
    expect(formatSessionRowDuration("2026-03-20T10:00:00Z", null, 1000)).toBe(
      "–",
    )
  })
})
