import { describe, expect, it } from "vitest"
import { pierreRegulars, rankRegulars } from "./regulars"

describe("rankRegulars", () => {
  it("ranks by numeric reps descending, duration-only last", () => {
    const ranked = rankRegulars([
      { name: "Walk", reps: 80 },
      { name: "Plank", reps: null },
      { name: "Pull-up", reps: 400 },
    ])
    expect(ranked.map((row) => row.name)).toEqual(["Pull-up", "Walk", "Plank"])
  })
})

describe("pierreRegulars", () => {
  it("follows the window: fewer moves on 7d, Pull-up leads 100d", () => {
    const week = rankRegulars(pierreRegulars("7"))
    const hundred = rankRegulars(pierreRegulars("100"))
    expect(week).toHaveLength(5)
    expect(week[0]?.name).toBe("Squat")
    expect(week[0]?.reps).toBe(48)
    expect(hundred).toHaveLength(8)
    expect(hundred[0]?.name).toBe("Pull-up")
    expect(hundred[0]?.reps).toBe(400)
  })
})
