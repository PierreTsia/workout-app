import { describe, it, expect } from "vitest"
import { EQUIPMENT_TAXONOMY } from "@/lib/catalogTaxonomy"
import { resolveIncrement } from "@/lib/rirSuggestion"
import {
  DEFAULT_LOAD_LADDERS,
  LADDER_MATCH_TOLERANCE_KG,
  LOAD_JUMP_MAX_RATIO,
  LOAD_LADDERS_KG,
  LOAD_LADDER_CATEGORY,
  loadJumpRatio,
  nextLoad,
  resolveLoadLadder,
  type LadderCategory,
} from "./loadLadder"

const CATEGORIES: LadderCategory[] = ["dumbbell", "barbell", "stack"]

describe("DEFAULT_LOAD_LADDERS", () => {
  it.each(["kg", "lbs"] as const)(
    "%s — every default table is strictly increasing",
    (unit) => {
      for (const category of CATEGORIES) {
        const ladder = DEFAULT_LOAD_LADDERS[unit][category]
        expect(ladder, `${unit}.${category}`).toBeDefined()
        for (let i = 1; i < ladder!.length; i++) {
          expect(ladder![i]).toBeGreaterThan(ladder![i - 1])
        }
      }
    },
  )
})

describe("LOAD_LADDER_CATEGORY", () => {
  it("covers every EQUIPMENT_TAXONOMY slug", () => {
    for (const slug of EQUIPMENT_TAXONOMY) {
      expect(LOAD_LADDER_CATEGORY).toHaveProperty(slug)
    }
  })

  it("maps the ladder-bearing slugs onto the three categories", () => {
    expect(LOAD_LADDER_CATEGORY.dumbbell).toBe("dumbbell")
    expect(LOAD_LADDER_CATEGORY.kettlebell).toBe("dumbbell")
    expect(LOAD_LADDER_CATEGORY.barbell).toBe("barbell")
    expect(LOAD_LADDER_CATEGORY.ez_bar).toBe("barbell")
    expect(LOAD_LADDER_CATEGORY.machine).toBe("stack")
    expect(LOAD_LADDER_CATEGORY.cable).toBe("stack")
  })

  it("gives no ladder to the load-agnostic slugs", () => {
    expect(LOAD_LADDER_CATEGORY.bench).toBeNull()
    expect(LOAD_LADDER_CATEGORY.bodyweight).toBeNull()
    expect(LOAD_LADDER_CATEGORY.band).toBeNull()
    expect(LOAD_LADDER_CATEGORY.other).toBeNull()
  })
})

describe("resolveLoadLadder", () => {
  it("returns the kg ladder of the equipment's category", () => {
    expect(resolveLoadLadder("dumbbell", "kg")).toEqual(
      DEFAULT_LOAD_LADDERS.kg.dumbbell,
    )
    expect(resolveLoadLadder("kettlebell", "kg")).toBe(
      LOAD_LADDERS_KG.kg.dumbbell,
    )
    expect(resolveLoadLadder("ez_bar", "lbs")).toBe(LOAD_LADDERS_KG.lbs.barbell)
  })

  it("returns null when the equipment declares no ladder", () => {
    expect(resolveLoadLadder("bodyweight", "kg")).toBeNull()
    expect(resolveLoadLadder("band", "lbs")).toBeNull()
    expect(resolveLoadLadder("bench", "kg")).toBeNull()
  })

  it("returns null for a missing or unknown equipment slug", () => {
    expect(resolveLoadLadder(undefined, "kg")).toBeNull()
    expect(resolveLoadLadder("", "kg")).toBeNull()
    expect(resolveLoadLadder("smith-machine", "kg")).toBeNull()
  })

  it("returns the lbs ladder converted to kg", () => {
    const ladder = resolveLoadLadder("dumbbell", "lbs")!
    expect(ladder[0]).toBeCloseTo(5 / 2.20462, 4)
    expect(ladder[8]).toBeCloseTo(45 / 2.20462, 4)
  })
})

describe("coherence with the inherited increment (rirSuggestion.ts)", () => {
  it("the first step of each table matches the legacy first-step increment", () => {
    const firstStep = (unit: "kg" | "lbs", category: LadderCategory) => {
      const ladder = DEFAULT_LOAD_LADDERS[unit][category]!
      return ladder[1] - ladder[0]
    }

    expect(firstStep("kg", "dumbbell")).toBe(resolveIncrement("kg", "dumbbell"))
    expect(firstStep("kg", "barbell")).toBe(resolveIncrement("kg", "barbell"))
    expect(firstStep("lbs", "dumbbell")).toBe(resolveIncrement("lbs", "dumbbell"))
    expect(firstStep("lbs", "barbell")).toBe(resolveIncrement("lbs", "barbell"))
  })
})

describe("nextLoad", () => {
  it("returns the first rung strictly above the current load", () => {
    expect(nextLoad([2, 4, 6, 8, 10], 4)).toBe(6)
    expect(nextLoad([2, 4, 6, 8, 10], 3)).toBe(4)
  })

  it("the current load's own rung is not its next rung", () => {
    expect(nextLoad([20, 25], 20)).toBe(25)
  })

  it("absorbs the display tolerance", () => {
    expect(LADDER_MATCH_TOLERANCE_KG).toBe(0.1)
    // A 45 lb rung stored as 20,4 kg must not read as its own next rung.
    expect(nextLoad([20.4116, 22.6796], 20.4)).toBeCloseTo(22.6796, 4)
  })

  it("returns null above the last rung or on an empty ladder", () => {
    expect(nextLoad([2, 4, 6], 6)).toBeNull()
    expect(nextLoad([2, 4, 6], 100)).toBeNull()
    expect(nextLoad([], 10)).toBeNull()
  })
})

describe("loadJumpRatio", () => {
  it("is the relative step from one load to the next", () => {
    expect(loadJumpRatio(20, 25)).toBe(0.25)
    expect(loadJumpRatio(20, 30)).toBe(0.5)
    expect(loadJumpRatio(100, 102.5)).toBe(0.025)
  })

  it("leaves the 30 % threshold where the dumbbell ladder needs it", () => {
    expect(LOAD_JUMP_MAX_RATIO).toBe(0.3)
    // The standard dumbbell jump is accepted; a poor gym's 20 → 30 is refused.
    expect(loadJumpRatio(20, 25)).toBeLessThanOrEqual(LOAD_JUMP_MAX_RATIO)
    expect(loadJumpRatio(20, 30)).toBeGreaterThan(LOAD_JUMP_MAX_RATIO)
  })

  it("is Infinity when there is no load to jump from", () => {
    expect(loadJumpRatio(0, 25)).toBe(Infinity)
    expect(loadJumpRatio(-5, 25)).toBe(Infinity)
  })
})
