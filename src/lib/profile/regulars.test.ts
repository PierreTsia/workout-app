import { describe, expect, it } from "vitest"
import { rankRegulars } from "./regulars"

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
