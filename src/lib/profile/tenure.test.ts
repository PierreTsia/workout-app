import { describe, expect, it } from "vitest"
import { localDateFromIsoDay, tenureSpan } from "./tenure"

const NOW = new Date(2026, 7, 21)

function monthsAgo(months: number): Date {
  return new Date(NOW.getFullYear(), NOW.getMonth() - months, NOW.getDate())
}

function daysAgo(days: number): Date {
  return new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - days)
}

describe("tenureSpan", () => {
  it("counts days when the span is under 60 days", () => {
    expect(tenureSpan(daysAgo(20), NOW)).toEqual({ kind: "days", n: 20 })
  })

  it("counts months when the span is 6 months", () => {
    expect(tenureSpan(monthsAgo(6), NOW)).toEqual({ kind: "months", n: 6 })
  })

  it("rounds 18 months to a year and a half", () => {
    expect(tenureSpan(monthsAgo(18), NOW)).toEqual({
      kind: "years",
      n: 1,
      half: true,
    })
  })

  it("keeps 2 years as whole years", () => {
    expect(tenureSpan(monthsAgo(24), NOW)).toEqual({
      kind: "years",
      n: 2,
      half: false,
    })
  })

  it("rounds Pierre's first session (~2y 5m) to two and a half years", () => {
    expect(tenureSpan(localDateFromIsoDay("2024-03-12"), NOW)).toEqual({
      kind: "years",
      n: 2,
      half: true,
    })
  })
})
