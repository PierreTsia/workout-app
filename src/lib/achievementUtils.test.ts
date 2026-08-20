import { describe, expect, it } from "vitest"
import {
  coerceNumeric,
  pickHero,
  supportingMedals,
  supportingOverflow,
} from "./achievementUtils"
import type { UnlockedAchievement } from "@/types/achievements"

function makeUnlock(
  overrides: Partial<UnlockedAchievement> = {},
): UnlockedAchievement {
  return {
    tier_id: "tier-1",
    group_slug: "volume_king",
    rank: "gold",
    title_en: "Volume King",
    title_fr: "Roi du Volume",
    icon_asset_url: null,
    threshold_value: 5000,
    ...overrides,
  }
}

describe("pickHero", () => {
  it("picks the highest rank in the batch (diamond over lower metals)", () => {
    const gold = makeUnlock({ tier_id: "gold", rank: "gold" })
    const diamond = makeUnlock({ tier_id: "diamond", rank: "diamond" })
    const bronze = makeUnlock({ tier_id: "bronze", rank: "bronze" })

    expect(pickHero([gold, diamond, bronze])).toBe(diamond)
  })

  it("keeps the first item when ranks tie", () => {
    const firstGold = makeUnlock({
      tier_id: "gold-first",
      rank: "gold",
      title_en: "First Gold",
    })
    const secondGold = makeUnlock({
      tier_id: "gold-second",
      rank: "gold",
      title_en: "Second Gold",
    })
    const silver = makeUnlock({ tier_id: "silver", rank: "silver" })

    expect(pickHero([firstGold, silver, secondGold])).toBe(firstGold)
  })
})

describe("supportingMedals", () => {
  it("returns non-hero items in original order", () => {
    const bronze = makeUnlock({
      tier_id: "bronze",
      rank: "bronze",
      title_en: "First Steps",
    })
    const gold = makeUnlock({
      tier_id: "gold",
      rank: "gold",
      title_en: "Volume King",
    })
    const silver = makeUnlock({
      tier_id: "silver",
      rank: "silver",
      title_en: "Quiet Strength",
    })
    const batch = [bronze, gold, silver]

    expect(supportingMedals(batch, gold)).toEqual([bronze, silver])
  })
})

describe("supportingOverflow", () => {
  it("keeps the first 3 visible and reports overflow beyond that", () => {
    const supporting = [
      makeUnlock({ tier_id: "s1", rank: "bronze" }),
      makeUnlock({ tier_id: "s2", rank: "silver" }),
      makeUnlock({ tier_id: "s3", rank: "gold" }),
      makeUnlock({ tier_id: "s4", rank: "platinum" }),
      makeUnlock({ tier_id: "s5", rank: "bronze", title_en: "Extra" }),
    ]

    expect(supportingOverflow(supporting)).toEqual({
      visible: supporting.slice(0, 3),
      overflowCount: 2,
    })
  })

  it("reports no overflow when three or fewer supporting medals", () => {
    const supporting = [
      makeUnlock({ tier_id: "s1", rank: "bronze" }),
      makeUnlock({ tier_id: "s2", rank: "silver" }),
    ]

    expect(supportingOverflow(supporting)).toEqual({
      visible: supporting,
      overflowCount: 0,
    })
  })
})

describe("coerceNumeric", () => {
  it("keeps finite numbers", () => {
    expect(coerceNumeric(3)).toBe(3)
    expect(coerceNumeric(5000.5)).toBe(5000.5)
  })

  it("parses PostgREST NUMERIC strings", () => {
    expect(coerceNumeric("3")).toBe(3)
    expect(coerceNumeric("5000.5")).toBe(5000.5)
  })

  it("returns NaN for junk so callers can hide the threshold line", () => {
    expect(Number.isFinite(coerceNumeric("nope"))).toBe(false)
    expect(Number.isFinite(coerceNumeric(null))).toBe(false)
    expect(Number.isFinite(coerceNumeric(undefined))).toBe(false)
    expect(Number.isFinite(coerceNumeric({}))).toBe(false)
  })
})
