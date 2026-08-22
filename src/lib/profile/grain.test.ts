import { describe, expect, it } from "vitest"
import {
  grainKey,
  isoWeekMonday,
  parseGrainKey,
  profileBuckets,
} from "./grain"

describe("parseGrainKey", () => {
  it("splits ISO day, week, month, and year keys", () => {
    expect(parseGrainKey("2026-08-17")).toEqual({
      kind: "day",
      day: "2026-08-17",
    })
    expect(parseGrainKey("2026-W34")).toEqual({
      kind: "isoWeek",
      year: 2026,
      week: 34,
    })
    expect(parseGrainKey("2026-08")).toEqual({
      kind: "month",
      year: 2026,
      month: 8,
    })
    expect(parseGrainKey("2026")).toEqual({ kind: "year", year: 2026 })
    expect(parseGrainKey("W3")).toEqual({ kind: "legacy", raw: "W3" })
  })
})

describe("profileBuckets", () => {
  it("labels 30d weeks with the ISO week number, not W-n offsets", () => {
    const buckets = profileBuckets("30", "2026-07-23", "2026-08-21")
    expect(buckets.every((bucket) => /^2026-W\d{2}$/.test(bucket.key))).toBe(
      true,
    )
    expect(buckets.map((bucket) => bucket.label)).toEqual(
      buckets.map((bucket) => {
        const parsed = parseGrainKey(bucket.key)
        return parsed.kind === "isoWeek" ? `W${parsed.week}` : bucket.label
      }),
    )
    expect(buckets.some((bucket) => bucket.label.startsWith("W-"))).toBe(false)
    expect(buckets.at(-1)?.key).toBe(grainKey("2026-08-21", "isoWeek"))
  })
})

describe("isoWeekMonday", () => {
  it("pins 2026-W34 to Monday 17 August", () => {
    const monday = isoWeekMonday(2026, 34)
    expect(monday.getFullYear()).toBe(2026)
    expect(monday.getMonth()).toBe(7)
    expect(monday.getDate()).toBe(17)
  })
})
