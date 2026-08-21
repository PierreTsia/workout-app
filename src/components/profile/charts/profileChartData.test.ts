import { describe, expect, it } from "vitest"
import { RADAR_CURRENT } from "./fixtures"
import {
  profileTickInterval,
  scaleRadarCredits,
  toMuscleSetRanks,
} from "./profileChartData"

describe("profileTickInterval", () => {
  it("keeps every tick on a week and thins a 100-day week axis", () => {
    expect(profileTickInterval(7)).toBe(0)
    expect(profileTickInterval(8)).toBe(0)
    expect(profileTickInterval(14)).toBe("preserveStartEnd")
  })
})

describe("toMuscleSetRanks", () => {
  it("ranks credited sets from the radar shape, pecs first", () => {
    const ranks = toMuscleSetRanks(scaleRadarCredits(RADAR_CURRENT))
    expect(ranks[0]).toMatchObject({ muscle: "Pectoraux", sets: 18 })
    expect(ranks[ranks.length - 1]).toMatchObject({ muscle: "Adducteurs", sets: 5 })
    expect(ranks).toHaveLength(13)
    expect(ranks[0]?.fill).toBe(1)
  })
})
