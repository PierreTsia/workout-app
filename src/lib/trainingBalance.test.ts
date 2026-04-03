import { describe, expect, it } from "vitest"
import {
  AGONIST_PAIRS,
  balanceBandFromScore,
  computeBalanceScore,
  computePairInsights,
  MUSCLE_TAXONOMY,
  setsRecordFromRows,
  zeroVolumeMuscles,
} from "./trainingBalance"

describe("computeBalanceScore", () => {
  it("returns 0 for empty input", () => {
    expect(computeBalanceScore([])).toBe(0)
  })

  it("returns 0 when all zeros", () => {
    expect(computeBalanceScore(Array(13).fill(0))).toBe(0)
  })

  it("returns 100 for perfectly even distribution", () => {
    const v = Array(13).fill(10)
    expect(computeBalanceScore(v)).toBe(100)
  })

  it("returns lower score when one muscle dominates", () => {
    const even = Array(13).fill(5)
    const skewed = [...even]
    skewed[0] = 500
    expect(computeBalanceScore(skewed)).toBeLessThan(computeBalanceScore(even))
  })

  it("treats zero muscles as hurting the score", () => {
    const some = MUSCLE_TAXONOMY.map((_, i) => (i < 8 ? 10 : 0))
    const all = MUSCLE_TAXONOMY.map(() => 10)
    expect(computeBalanceScore(some)).toBeLessThan(computeBalanceScore(all))
  })

  it("does not collapse to ~20 for strong coverage with uneven volume (log1p CV)", () => {
    const taxonomyOrder = [
      48, 39, 66, 53, 43, 13, 18, 12, 0, 7, 27, 6, 10.5,
    ] as const
    expect(taxonomyOrder.length).toBe(13)
    expect(computeBalanceScore(taxonomyOrder)).toBe(62)
  })
})

describe("balanceBandFromScore", () => {
  it("maps threshold boundaries", () => {
    expect(balanceBandFromScore(100)).toBe("excellent")
    expect(balanceBandFromScore(85)).toBe("excellent")
    expect(balanceBandFromScore(84)).toBe("good")
    expect(balanceBandFromScore(70)).toBe("good")
    expect(balanceBandFromScore(69)).toBe("attention")
    expect(balanceBandFromScore(50)).toBe("attention")
    expect(balanceBandFromScore(49)).toBe("imbalanced")
    expect(balanceBandFromScore(0)).toBe("imbalanced")
  })
})

describe("computePairInsights", () => {
  it("skips when both sides are zero", () => {
    const rec = setsRecordFromRows(
      MUSCLE_TAXONOMY.map((m) => ({ muscle_group: m, total_sets: 0 })),
    )
    expect(computePairInsights(rec)).toEqual([])
  })

  it("emits untrained when one side is zero", () => {
    const rows = MUSCLE_TAXONOMY.map((m) => ({
      muscle_group: m,
      total_sets: m === "Pectoraux" ? 12 : m === "Dos" ? 0 : 5,
    }))
    const rec = setsRecordFromRows(rows)
    const insights = computePairInsights(rec)
    const chestBack = insights.find((i) => i.pairName === "chest_back")
    expect(chestBack?.kind).toBe("untrained")
    expect(chestBack?.focusMuscle).toBe("Dos")
    expect(chestBack?.otherMuscle).toBe("Pectoraux")
  })

  it("emits skewed when ratio is below 0.5", () => {
    const rows = MUSCLE_TAXONOMY.map((m) => ({
      muscle_group: m,
      total_sets:
        m === "Biceps" ? 10 : m === "Triceps" ? 4 : 6,
    }))
    const rec = setsRecordFromRows(rows)
    const insights = computePairInsights(rec)
    const bt = insights.find((i) => i.pairName === "biceps_triceps")
    expect(bt?.kind).toBe("skewed")
    expect(bt?.ratio).toBeCloseTo(0.4, 5)
    expect(bt?.focusMuscle).toBe("Biceps")
  })

  it("does not emit skewed when ratio is exactly 0.5", () => {
    const rows = MUSCLE_TAXONOMY.map((m) => ({
      muscle_group: m,
      total_sets: m === "Quadriceps" ? 10 : m === "Ischios" ? 5 : 7,
    }))
    const rec = setsRecordFromRows(rows)
    const insights = computePairInsights(rec)
    expect(insights.some((i) => i.pairName === "quads_hams")).toBe(false)
  })
})

describe("AGONIST_PAIRS", () => {
  it("has four pairs", () => {
    expect(AGONIST_PAIRS).toHaveLength(4)
  })
})

describe("zeroVolumeMuscles", () => {
  it("lists muscles with zero total_sets", () => {
    const rows = MUSCLE_TAXONOMY.map((m) => ({
      muscle_group: m,
      total_sets: m === "Mollets" ? 0 : 3,
    }))
    expect(zeroVolumeMuscles(rows)).toEqual(["Mollets"])
  })
})
