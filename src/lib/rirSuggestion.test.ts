import { describe, it, expect } from "vitest"
import type { WorkoutExercise } from "@/types/database"
import {
  getAdjustmentTier,
  parseTargetRepRange,
  detectFatigue,
  computeIntraSessionSuggestion,
  computeCascadeSuggestions,
  computeIntraSessionSuggestionLegacy,
  resolveIncrement,
} from "./rirSuggestion"
import type {
  CompletedSetInfo,
  IntraSessionContext,
} from "./rirSuggestion"

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeCtx(
  overrides: Partial<IntraSessionContext> = {},
): IntraSessionContext {
  return {
    completedSets: [],
    currentRir: 2,
    currentWeight: 80,
    currentReps: 10,
    targetRepRange: { min: 8, max: 12 },
    unit: "kg",
    equipment: "barbell",
    tier: "weight-first",
    ...overrides,
  }
}

function makeExercise(
  overrides: Partial<WorkoutExercise> = {},
): WorkoutExercise {
  return {
    id: "ex1",
    workout_day_id: "d1",
    exercise_id: "e1",
    name_snapshot: "Bench Press",
    muscle_snapshot: "chest",
    emoji_snapshot: "🏋️",
    sets: 4,
    reps: "10",
    weight: "80",
    rest_seconds: 90,
    sort_order: 0,
    ...overrides,
  }
}

function makeSets(...rirs: number[]): CompletedSetInfo[] {
  return rirs.map((rir) => ({ reps: 10, weight: 80, rir }))
}

// ---------------------------------------------------------------------------
// getAdjustmentTier
// ---------------------------------------------------------------------------

describe("getAdjustmentTier", () => {
  it.each([
    ["barbell", "weight-first"],
    ["dumbbell", "weight-first"],
    ["ez_bar", "weight-first"],
    ["machine", "weight-first"],
    ["bench", "weight-first"],
    ["kettlebell", "weight-first"],
  ] as const)("%s → %s", (eq, expected) => {
    expect(getAdjustmentTier(eq, 80)).toBe(expected)
  })

  it.each([
    ["bodyweight", "reps-only"],
    ["cable", "reps-only"],
    ["band", "reps-only"],
  ] as const)("%s → %s", (eq, expected) => {
    expect(getAdjustmentTier(eq, 0)).toBe(expected)
  })

  it("defaults unknown equipment to weight-first", () => {
    expect(getAdjustmentTier("something_unknown", 50)).toBe("weight-first")
  })

  it("promotes bodyweight to weight-first when loggedWeight > 0", () => {
    expect(getAdjustmentTier("bodyweight", 10)).toBe("weight-first")
  })
})

// ---------------------------------------------------------------------------
// parseTargetRepRange
// ---------------------------------------------------------------------------

describe("parseTargetRepRange", () => {
  it("uses structured rep_range_min/max when available", () => {
    const ex = makeExercise({ rep_range_min: 8, rep_range_max: 12 })
    expect(parseTargetRepRange(ex)).toEqual({ min: 8, max: 12 })
  })

  it("falls back to parsing range string", () => {
    const ex = makeExercise({ reps: "8-12" })
    expect(parseTargetRepRange(ex)).toEqual({ min: 8, max: 12 })
  })

  it("parses fixed number string", () => {
    const ex = makeExercise({ reps: "10" })
    expect(parseTargetRepRange(ex)).toEqual({ min: 10, max: 10 })
  })

  it("returns null for AMRAP", () => {
    expect(parseTargetRepRange(makeExercise({ reps: "AMRAP" }))).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseTargetRepRange(makeExercise({ reps: "" }))).toBeNull()
  })

  it("ignores partial structured fields (only min)", () => {
    const ex = makeExercise({ rep_range_min: 8, reps: "10" })
    expect(parseTargetRepRange(ex)).toEqual({ min: 10, max: 10 })
  })

  it("structured fields take priority over string", () => {
    const ex = makeExercise({
      rep_range_min: 6,
      rep_range_max: 10,
      reps: "8-12",
    })
    expect(parseTargetRepRange(ex)).toEqual({ min: 6, max: 10 })
  })
})

// ---------------------------------------------------------------------------
// detectFatigue
// ---------------------------------------------------------------------------

describe("detectFatigue", () => {
  it("returns true for 2-set decline (3 → 2)", () => {
    expect(detectFatigue(makeSets(3, 2))).toBe(true)
  })

  it("returns true for 3-set decline (3 → 2 → 1)", () => {
    expect(detectFatigue(makeSets(3, 2, 1))).toBe(true)
  })

  it("returns false for flat sequence (2 → 2)", () => {
    expect(detectFatigue(makeSets(2, 2))).toBe(false)
  })

  it("returns false for rising sequence (1 → 2)", () => {
    expect(detectFatigue(makeSets(1, 2))).toBe(false)
  })

  it("returns false for single set", () => {
    expect(detectFatigue(makeSets(2))).toBe(false)
  })

  it("returns false for empty array", () => {
    expect(detectFatigue([])).toBe(false)
  })

  it("only considers trailing decline (2 → 3 → 2 → 1)", () => {
    expect(detectFatigue(makeSets(2, 3, 2, 1))).toBe(true)
  })

  it("does not trigger when decline is not at the tail (3 → 2 → 2)", () => {
    expect(detectFatigue(makeSets(3, 2, 2))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeIntraSessionSuggestion — weight-first tier
// ---------------------------------------------------------------------------

describe("computeIntraSessionSuggestion — weight-first", () => {
  describe("RIR 0 (failure)", () => {
    it("no shortfall: drops weight by 1 increment, holds reps", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({ currentRir: 0, currentReps: 10 }),
      )
      expect(r).toEqual({ weight: 77.5, reps: "10" })
    })

    it("with shortfall: drops weight by 1 increment, reps = actual", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({ currentRir: 0, currentReps: 6 }),
      )
      expect(r).toEqual({ weight: 77.5, reps: "6" })
    })

    it("floors weight at one increment", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({ currentRir: 0, currentWeight: 2.5 }),
      )
      expect(r).toEqual({ weight: 2.5, reps: "10" })
    })

    it("returns 0 weight when currentWeight is 0", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({ currentRir: 0, currentWeight: 0 }),
      )
      expect(r).toEqual({ weight: 0, reps: "10" })
    })
  })

  describe("RIR 1-2 (efficiency)", () => {
    it("no shortfall: hold everything", () => {
      const r = computeIntraSessionSuggestion(makeCtx({ currentRir: 2 }))
      expect(r).toEqual({ weight: 80, reps: "10" })
    })

    it("with shortfall: hold weight, reps = actual", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({ currentRir: 1, currentReps: 6 }),
      )
      expect(r).toEqual({ weight: 80, reps: "6" })
    })
  })

  describe("RIR 3+ (undershoot)", () => {
    it("no shortfall: bumps weight by 1 increment", () => {
      const r = computeIntraSessionSuggestion(makeCtx({ currentRir: 3 }))
      expect(r).toEqual({ weight: 82.5, reps: "10" })
    })

    it("RIR 4 also bumps weight", () => {
      const r = computeIntraSessionSuggestion(makeCtx({ currentRir: 4 }))
      expect(r).toEqual({ weight: 82.5, reps: "10" })
    })

    it("with shortfall: holds weight, reps = actual (contradictory signal)", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({ currentRir: 3, currentReps: 6 }),
      )
      expect(r).toEqual({ weight: 80, reps: "6" })
    })
  })

  describe("fatigue bucket-shift", () => {
    it("RIR 1-2 + fatigue → failure: drops weight", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({
          currentRir: 2,
          completedSets: makeSets(3, 2),
        }),
      )
      expect(r).toEqual({ weight: 77.5, reps: "10" })
    })

    it("RIR 3 + fatigue → efficiency: holds", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({
          currentRir: 3,
          completedSets: makeSets(3, 2),
        }),
      )
      expect(r).toEqual({ weight: 80, reps: "10" })
    })

    it("RIR 0 + fatigue → still failure (can't shift lower)", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({
          currentRir: 0,
          completedSets: makeSets(3, 2),
        }),
      )
      expect(r).toEqual({ weight: 77.5, reps: "10" })
    })
  })

  describe("dumbbell increments", () => {
    it("uses 2 kg increment for dumbbell", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({ currentRir: 3, equipment: "dumbbell", currentWeight: 20 }),
      )
      expect(r).toEqual({ weight: 22, reps: "10" })
    })

    it("uses 2 kg decrement for dumbbell failure", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({ currentRir: 0, equipment: "dumbbell", currentWeight: 20 }),
      )
      expect(r).toEqual({ weight: 18, reps: "10" })
    })
  })

  describe("lbs units", () => {
    it("uses 5 lbs increment", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({ currentRir: 3, unit: "lbs", currentWeight: 135 }),
      )
      expect(r).toEqual({ weight: 140, reps: "10" })
    })

    it("uses 5 lbs decrement on failure", () => {
      const r = computeIntraSessionSuggestion(
        makeCtx({ currentRir: 0, unit: "lbs", currentWeight: 135 }),
      )
      expect(r).toEqual({ weight: 130, reps: "10" })
    })
  })
})

// ---------------------------------------------------------------------------
// computeIntraSessionSuggestion — reps-only tier
// ---------------------------------------------------------------------------

describe("computeIntraSessionSuggestion — reps-only", () => {
  const repsCtx = (overrides: Partial<IntraSessionContext> = {}) =>
    makeCtx({
      equipment: "bodyweight",
      tier: "reps-only",
      currentWeight: 0,
      ...overrides,
    })

  describe("RIR 0 (failure)", () => {
    it("no shortfall: proportional deload (10 → 9)", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({ currentRir: 0, currentReps: 10 }),
      )
      // round(10 * 0.85) = round(8.5) = 9, min(9, 10-1) = 9
      expect(r).toEqual({ weight: 0, reps: "9" })
    })

    it("no shortfall: proportional deload (20 → 17)", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({ currentRir: 0, currentReps: 20 }),
      )
      // round(20 * 0.85) = round(17) = 17, min(17, 19) = 17
      expect(r).toEqual({ weight: 0, reps: "17" })
    })

    it("no shortfall: enforces min drop of 1 at low reps (3 → 2)", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({
          currentRir: 0,
          currentReps: 3,
          targetRepRange: { min: 1, max: 5 },
        }),
      )
      // round(3 * 0.85) = round(2.55) = 3, min(3, 3-1) = 2, max(1, 2) = 2
      expect(r).toEqual({ weight: 0, reps: "2" })
    })

    it("no shortfall: never goes below 1 rep", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({ currentRir: 0, currentReps: 1 }),
      )
      expect(r).toEqual({ weight: 0, reps: "1" })
    })

    it("with shortfall: reps = actual logged", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({ currentRir: 0, currentReps: 6 }),
      )
      expect(r).toEqual({ weight: 0, reps: "6" })
    })

    it("weight is suppressed (cable with existing weight)", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({
          currentRir: 0,
          currentReps: 10,
          equipment: "cable",
          currentWeight: 30,
        }),
      )
      expect(r.weight).toBe(30)
    })
  })

  describe("RIR 1-2 (efficiency)", () => {
    it("no shortfall: hold", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({ currentRir: 2, currentReps: 10 }),
      )
      expect(r).toEqual({ weight: 0, reps: "10" })
    })

    it("with shortfall: reps = actual", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({ currentRir: 1, currentReps: 6 }),
      )
      expect(r).toEqual({ weight: 0, reps: "6" })
    })
  })

  describe("RIR 3+ (undershoot)", () => {
    it("no shortfall: +1 rep", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({ currentRir: 3, currentReps: 10 }),
      )
      expect(r).toEqual({ weight: 0, reps: "11" })
    })

    it("caps at range max", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({
          currentRir: 3,
          currentReps: 12,
          targetRepRange: { min: 8, max: 12 },
        }),
      )
      expect(r).toEqual({ weight: 0, reps: "12" })
    })

    it("with shortfall: holds at actual (contradictory)", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({ currentRir: 3, currentReps: 6 }),
      )
      expect(r).toEqual({ weight: 0, reps: "6" })
    })
  })

  describe("fatigue bucket-shift (reps-only)", () => {
    it("RIR 3 + fatigue → efficiency: holds", () => {
      const r = computeIntraSessionSuggestion(
        repsCtx({
          currentRir: 3,
          currentReps: 10,
          completedSets: makeSets(3, 2),
        }),
      )
      expect(r).toEqual({ weight: 0, reps: "10" })
    })
  })
})

// ---------------------------------------------------------------------------
// computeIntraSessionSuggestion — null targetRepRange
// ---------------------------------------------------------------------------

describe("computeIntraSessionSuggestion — null range", () => {
  it("no shortfall detection: RIR 0 still deloads weight", () => {
    const r = computeIntraSessionSuggestion(
      makeCtx({ currentRir: 0, targetRepRange: null }),
    )
    expect(r).toEqual({ weight: 77.5, reps: "10" })
  })

  it("no shortfall detection: RIR 3 still bumps weight", () => {
    const r = computeIntraSessionSuggestion(
      makeCtx({ currentRir: 3, targetRepRange: null }),
    )
    expect(r).toEqual({ weight: 82.5, reps: "10" })
  })

  it("reps-only: RIR 3 with null range bumps without cap", () => {
    const r = computeIntraSessionSuggestion(
      makeCtx({
        currentRir: 3,
        targetRepRange: null,
        tier: "reps-only",
        equipment: "bodyweight",
        currentWeight: 0,
        currentReps: 15,
      }),
    )
    expect(r).toEqual({ weight: 0, reps: "16" })
  })
})

// ---------------------------------------------------------------------------
// computeCascadeSuggestions
// ---------------------------------------------------------------------------

describe("computeCascadeSuggestions", () => {
  it("deload cascades with 2-step cap (weight-first)", () => {
    const completed = makeSets(2, 0)
    const results = computeCascadeSuggestions(
      completed,
      4,
      { min: 8, max: 12 },
      "kg",
      "barbell",
    )
    expect(results).toHaveLength(4)
    // Step 1: 80 → 77.5 (−1 inc)
    expect(results[0].weight).toBe(77.5)
    // Step 2: 77.5 → 75 (−2 inc, capped)
    expect(results[1].weight).toBe(75)
    // Remaining hold at cap
    expect(results[2].weight).toBe(75)
    expect(results[3].weight).toBe(75)
  })

  it("increase applies once then holds (weight-first)", () => {
    const completed: CompletedSetInfo[] = [{ reps: 10, weight: 80, rir: 3 }]
    const results = computeCascadeSuggestions(
      completed,
      3,
      { min: 8, max: 12 },
      "kg",
      "barbell",
    )
    expect(results).toHaveLength(3)
    expect(results[0].weight).toBe(82.5)
    expect(results[1].weight).toBe(82.5)
    expect(results[2].weight).toBe(82.5)
  })

  it("hold produces identical suggestions for all", () => {
    const completed: CompletedSetInfo[] = [{ reps: 10, weight: 80, rir: 2 }]
    const results = computeCascadeSuggestions(
      completed,
      3,
      { min: 8, max: 12 },
      "kg",
      "barbell",
    )
    expect(results).toHaveLength(3)
    results.forEach((r) => {
      expect(r).toEqual({ weight: 80, reps: "10" })
    })
  })

  it("single remaining set", () => {
    const completed: CompletedSetInfo[] = [{ reps: 10, weight: 80, rir: 0 }]
    const results = computeCascadeSuggestions(
      completed,
      1,
      { min: 8, max: 12 },
      "kg",
      "barbell",
    )
    expect(results).toHaveLength(1)
    expect(results[0].weight).toBe(77.5)
  })

  it("reps-only deload cascade caps at 2 steps", () => {
    const completed: CompletedSetInfo[] = [
      { reps: 20, weight: 0, rir: 2 },
      { reps: 20, weight: 0, rir: 0 },
    ]
    const results = computeCascadeSuggestions(
      completed,
      4,
      { min: 15, max: 25 },
      "kg",
      "bodyweight",
    )
    expect(results).toHaveLength(4)
    // Fatigue detected (2 → 0), effective bucket for RIR 0 = failure
    // Step 1: 20 → 17 (round(20*0.85)=17)
    expect(results[0].reps).toBe("17")
    // Step 2: 17 → 14 (round(17*0.85)=14, min(14,16)=14), 2nd step → capped
    expect(results[1].reps).toBe("14")
    // Remaining hold at cap
    expect(results[2].reps).toBe("14")
    expect(results[3].reps).toBe("14")
  })

  it("returns empty array for 0 remaining", () => {
    expect(
      computeCascadeSuggestions(makeSets(2), 0, null, "kg", "barbell"),
    ).toEqual([])
  })

  it("returns empty array for empty completed sets", () => {
    expect(computeCascadeSuggestions([], 3, null, "kg", "barbell")).toEqual([])
  })

  it("tier is stable across cascade (bodyweight weight deloads to 0)", () => {
    const completed: CompletedSetInfo[] = [{ reps: 10, weight: 5, rir: 0 }]
    const results = computeCascadeSuggestions(
      completed,
      3,
      { min: 8, max: 12 },
      "kg",
      "bodyweight",
    )
    // bodyweight with weight=5 → promoted to weight-first
    // Failure: 5 → 2.5 → 2.5 (floored)
    expect(results[0].weight).toBe(2.5)
    expect(results[1].weight).toBe(2.5)
    expect(results[2].weight).toBe(2.5)
  })
})

// ---------------------------------------------------------------------------
// resolveIncrement
// ---------------------------------------------------------------------------

describe("resolveIncrement", () => {
  it("returns 2.5 for barbell kg", () => {
    expect(resolveIncrement("kg", "barbell")).toBe(2.5)
  })

  it("returns 2 for dumbbell kg", () => {
    expect(resolveIncrement("kg", "dumbbell")).toBe(2)
  })

  it("returns 5 for barbell lbs", () => {
    expect(resolveIncrement("lbs", "barbell")).toBe(5)
  })

  it("returns 5 for dumbbell lbs", () => {
    expect(resolveIncrement("lbs", "dumbbell")).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Legacy shim — mirrors old test suite to prove backwards compat
// ---------------------------------------------------------------------------

describe("computeIntraSessionSuggestionLegacy", () => {
  it("reduces weight by one increment when RIR is 0 (failure)", () => {
    const result = computeIntraSessionSuggestionLegacy(0, 80, "10", "kg")
    expect(result).toEqual({ weight: 77.5, reps: "10" })
  })

  it("floors weight at one increment when RIR 0 would go below", () => {
    const result = computeIntraSessionSuggestionLegacy(0, 2.5, "12", "kg")
    expect(result).toEqual({ weight: 2.5, reps: "12" })
  })

  it("keeps weight and reps when RIR is 1", () => {
    const result = computeIntraSessionSuggestionLegacy(1, 60, "8", "kg")
    expect(result).toEqual({ weight: 60, reps: "8" })
  })

  it("keeps weight and reps when RIR is 2", () => {
    const result = computeIntraSessionSuggestionLegacy(2, 100, "5", "lbs")
    expect(result).toEqual({ weight: 100, reps: "5" })
  })

  it("increases weight by one increment when RIR is 3 (undershoot)", () => {
    const result = computeIntraSessionSuggestionLegacy(3, 50, "10", "kg")
    expect(result).toEqual({ weight: 52.5, reps: "10" })
  })

  it("increases weight by one increment when RIR is 4+", () => {
    const result = computeIntraSessionSuggestionLegacy(4, 80, "10", "kg")
    expect(result).toEqual({ weight: 82.5, reps: "10" })
  })

  it("uses 5 lbs increment for imperial units", () => {
    const result = computeIntraSessionSuggestionLegacy(4, 135, "5", "lbs")
    expect(result).toEqual({ weight: 140, reps: "5" })
  })

  it("uses 5 lbs decrement for failure in imperial", () => {
    const result = computeIntraSessionSuggestionLegacy(0, 135, "5", "lbs")
    expect(result).toEqual({ weight: 130, reps: "5" })
  })

  it("returns 0 weight when prevWeight is 0 and RIR is 0 (bodyweight)", () => {
    const result = computeIntraSessionSuggestionLegacy(0, 0, "10", "kg")
    expect(result).toEqual({ weight: 0, reps: "10" })
  })

  describe("dumbbell equipment", () => {
    it("uses 2 kg increment for dumbbell RIR 4+", () => {
      const result = computeIntraSessionSuggestionLegacy(
        4,
        20,
        "10",
        "kg",
        "dumbbell",
      )
      expect(result).toEqual({ weight: 22, reps: "10" })
    })

    it("uses 2 kg decrement for dumbbell RIR 0", () => {
      const result = computeIntraSessionSuggestionLegacy(
        0,
        20,
        "10",
        "kg",
        "dumbbell",
      )
      expect(result).toEqual({ weight: 18, reps: "10" })
    })

    it("keeps weight for dumbbell RIR 1-2", () => {
      const result = computeIntraSessionSuggestionLegacy(
        2,
        16,
        "12",
        "kg",
        "dumbbell",
      )
      expect(result).toEqual({ weight: 16, reps: "12" })
    })

    it("floors dumbbell weight at 2 kg on failure", () => {
      const result = computeIntraSessionSuggestionLegacy(
        0,
        2,
        "15",
        "kg",
        "dumbbell",
      )
      expect(result).toEqual({ weight: 2, reps: "15" })
    })
  })

  it("uses default increment when equipment is barbell", () => {
    const result = computeIntraSessionSuggestionLegacy(
      4,
      80,
      "5",
      "kg",
      "barbell",
    )
    expect(result).toEqual({ weight: 82.5, reps: "5" })
  })

  it("uses default increment when equipment is undefined", () => {
    const result = computeIntraSessionSuggestionLegacy(
      4,
      80,
      "5",
      "kg",
      undefined,
    )
    expect(result).toEqual({ weight: 82.5, reps: "5" })
  })
})
