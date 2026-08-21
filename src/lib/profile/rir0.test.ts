import { describe, expect, it } from "vitest"
import { rir0Rate } from "./rir0"
import type { SetFact } from "./types"

function makeSet(overrides: Partial<SetFact> = {}): SetFact {
  return {
    session_id: "s1",
    exercise_id: "ex-1",
    was_pr: false,
    rir: 2,
    weight_logged: 80,
    reps: "8",
    duration_seconds: null,
    block_exercise_id: null,
    ...overrides,
  }
}

describe("RIR 0 rate", () => {
  it("returns no point when nothing is declared — null is not a default 2 and not 0%", () => {
    expect(
      rir0Rate([
        makeSet({ rir: null, duration_seconds: 45, reps: null, weight_logged: 0 }),
        makeSet({ rir: null }),
      ]),
    ).toBeNull()
  })

  it("is rir=0 over declared rir only — a missing value does not swell the denominator as 2", () => {
    expect(
      rir0Rate([
        makeSet({ rir: 0 }),
        makeSet({ rir: 2 }),
        makeSet({ rir: null, duration_seconds: 30, reps: null, weight_logged: 0 }),
      ]),
    ).toBe(50)
  })
})
