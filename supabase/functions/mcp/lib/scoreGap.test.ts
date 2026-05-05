import { describe, expect, it } from "vitest"
import { DEFAULT_AMBIGUITY_GAP, isAmbiguous, resolveAmbiguityGap } from "./scoreGap"

describe("isAmbiguous", () => {
  it("returns false when there are no matches (nothing to compare)", () => {
    expect(isAmbiguous([])).toBe(false)
  })

  it("returns false when there is a single match (no runner-up to compete)", () => {
    expect(isAmbiguous([{ score: 0.5 }])).toBe(false)
  })

  it("returns true when the gap between top-1 and top-2 is below the default threshold", () => {
    // top-1 = 0.80, top-2 = 0.75 → gap 0.05 < 0.10 → ambiguous
    expect(isAmbiguous([{ score: 0.8 }, { score: 0.75 }])).toBe(true)
  })

  it("is NaN-safe — returns false when scores are NaN (defensive: no crash, no false-ambiguous)", () => {
    expect(isAmbiguous([{ score: NaN }, { score: NaN }])).toBe(false)
    expect(isAmbiguous([{ score: 0.5 }, { score: NaN }])).toBe(false)
  })

  it("returns false when the gap clearly exceeds the default threshold", () => {
    // top-1 = 1.00, top-2 = 0.50 → gap 0.50 (well above 0.10) → not ambiguous.
    // Boundary-at-exactly-0.10 is intentionally NOT tested: float subtraction
    // (e.g. 0.9 - 0.8 = 0.0999999...) makes "exactly at threshold" semantically
    // ill-defined for similarity scores. The behaviour we care about is "clearly
    // close" vs "clearly apart"; the boundary itself is a noise zone.
    expect(isAmbiguous([{ score: 1.0 }, { score: 0.5 }])).toBe(false)
  })

  it("considers only the top-2 — a close third match doesn't make a clearly-separated top-2 pair ambiguous", () => {
    // top-1 = 1.0, top-2 = 0.5 (gap 0.5, NOT ambiguous), top-3 = 0.45 (close to top-2)
    // The top-3 closeness must NOT influence the verdict — only top-1 vs top-2 matters.
    expect(isAmbiguous([{ score: 1.0 }, { score: 0.5 }, { score: 0.45 }])).toBe(false)
  })

  it("honors a custom gap when provided (env-overridden threshold path)", () => {
    // Gap 0.05 between scores: ambiguous under default (0.10), NOT ambiguous under
    // a tighter threshold (0.01) — verifies the override propagates and the
    // strict `<` semantics still hold.
    const matches = [{ score: 0.8 }, { score: 0.75 }]
    expect(isAmbiguous(matches)).toBe(true) // default 0.10
    expect(isAmbiguous(matches, 0.01)).toBe(false) // tighter override
  })
})

describe("resolveAmbiguityGap", () => {
  it("returns the default gap when the env value is undefined (env var not set)", () => {
    expect(resolveAmbiguityGap(undefined)).toBe(DEFAULT_AMBIGUITY_GAP)
  })

  it("returns the parsed float when the env value is a valid number in (0, 1]", () => {
    expect(resolveAmbiguityGap("0.05")).toBe(0.05)
    expect(resolveAmbiguityGap("0.25")).toBe(0.25)
    expect(resolveAmbiguityGap("1")).toBe(1)
  })

  it("falls back to default for invalid inputs (empty, null, non-numeric, out-of-range)", () => {
    // Each case represents a real misconfiguration mode we'd rather absorb
    // silently than crash the handler on. Default is the safe fallback.
    expect(resolveAmbiguityGap("")).toBe(DEFAULT_AMBIGUITY_GAP)
    expect(resolveAmbiguityGap(null)).toBe(DEFAULT_AMBIGUITY_GAP)
    expect(resolveAmbiguityGap("abc")).toBe(DEFAULT_AMBIGUITY_GAP)
    expect(resolveAmbiguityGap("0")).toBe(DEFAULT_AMBIGUITY_GAP) // boundary: must be > 0
    expect(resolveAmbiguityGap("-0.1")).toBe(DEFAULT_AMBIGUITY_GAP)
    expect(resolveAmbiguityGap("1.5")).toBe(DEFAULT_AMBIGUITY_GAP) // > 1 makes no sense for a score gap
    expect(resolveAmbiguityGap("NaN")).toBe(DEFAULT_AMBIGUITY_GAP)
  })
})
