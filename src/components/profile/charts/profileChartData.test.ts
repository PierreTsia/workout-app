import { describe, expect, it } from "vitest"
import { MIX_7_CATEGORIES, MIX_7_SERIES, RADAR_CURRENT } from "./fixtures"
import {
  localizeProfileTick,
  profileTickInterval,
  scaleRadarCredits,
  toMixCountRows,
  toMuscleSetRanks,
} from "./profileChartData"

describe("profileTickInterval", () => {
  it("keeps every tick on a week and thins a 100-day week axis", () => {
    expect(profileTickInterval(7)).toBe(0)
    expect(profileTickInterval(8)).toBe(0)
    expect(profileTickInterval(14)).toBe("preserveStartEnd")
  })
})

describe("localizeProfileTick", () => {
  const fr = (key: string, options?: Record<string, string | number>) => {
    if (key === "rhythm.weekCurrent") return "S"
    if (key === "rhythm.weekAgo") return `S-${options?.n}`
    if (key === "rhythm.week") return `S${options?.n}`
    return key
  }

  it("maps English week marks to French S-labels", () => {
    expect(localizeProfileTick("W", fr)).toBe("S")
    expect(localizeProfileTick("W-14", fr)).toBe("S-14")
    expect(localizeProfileTick("W3", fr)).toBe("S3")
    expect(localizeProfileTick("2026-W34", fr)).toBe("S34")
    expect(localizeProfileTick("Mon", fr)).toBe("Mon")
  })
})

describe("toMixCountRows", () => {
  it("keeps session counts instead of stretching every day to 100%", () => {
    const rows = toMixCountRows(MIX_7_CATEGORIES, MIX_7_SERIES)
    expect(rows[0]).toEqual({
      category: "Lun",
      programme: 1,
      quickWorkout: 0,
      circuits: 1,
    })
    expect(rows[2]).toEqual({
      category: "Mer",
      programme: 2,
      quickWorkout: 1,
      circuits: 0,
    })
    expect(rows[2]?.programme + rows[2]?.quickWorkout + rows[2]?.circuits).toBe(3)
    expect(rows[1]).toEqual({
      category: "Mar",
      programme: 0,
      quickWorkout: 0,
      circuits: 0,
    })
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
