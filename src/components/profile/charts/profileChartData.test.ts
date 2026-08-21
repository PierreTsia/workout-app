import { describe, expect, it } from "vitest"
import { RADAR_CURRENT } from "./fixtures"
import { toMuscleSetRanks } from "./profileChartData"

describe("toMuscleSetRanks", () => {
  it("ranks credited sets from the radar shape, pecs first", () => {
    const ranks = toMuscleSetRanks(RADAR_CURRENT)
    expect(ranks[0]).toMatchObject({ muscle: "Pectoraux", sets: 18 })
    expect(ranks[ranks.length - 1]).toMatchObject({ muscle: "Adducteurs", sets: 5 })
    expect(ranks).toHaveLength(13)
    expect(ranks[0]?.fill).toBe(1)
  })
})
