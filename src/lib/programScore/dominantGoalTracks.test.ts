import { describe, expect, it } from "vitest"
import {
  dominantGoalTracks,
  joinTrackNames,
} from "@/lib/programScore/dominantGoalTracks"
import type { ProgramScore } from "@/lib/programScore/types"

function score(overrides: Partial<ProgramScore> = {}): ProgramScore {
  return {
    hypertrophy: { band: "empty", volume: "empty", frequency: "empty" },
    strength: { band: "empty" },
    endurance: { band: "empty" },
    balance: { kind: "empty" },
    facts: {
      dayCount: 0,
      setCount: 0,
      circuitCount: 0,
      circuitModes: { amrap: 0, rounds: 0 },
      mix: { free: 0, machine: 0, bodyweight: 0, other: 0 },
    },
    ...overrides,
  }
}

describe("dominantGoalTracks", () => {
  it("returns nothing when every track is empty", () => {
    expect(dominantGoalTracks(score())).toEqual([])
  })

  it("picks the unique highest band", () => {
    expect(
      dominantGoalTracks(
        score({
          hypertrophy: { band: "short", volume: "short", frequency: "short" },
          strength: { band: "short" },
          endurance: { band: "ok" },
        }),
      ),
    ).toEqual(["endurance"])
  })

  it("keeps every track that shares the top band", () => {
    expect(
      dominantGoalTracks(
        score({
          hypertrophy: { band: "ok", volume: "ok", frequency: "ok" },
          strength: { band: "ok" },
          endurance: { band: "short" },
        }),
      ),
    ).toEqual(["hypertrophy", "strength"])
  })

  it("does not treat empty as a competitor", () => {
    expect(
      dominantGoalTracks(
        score({
          endurance: { band: "short" },
        }),
      ),
    ).toEqual(["endurance"])
  })
})

describe("joinTrackNames", () => {
  it("joins two names with a plus", () => {
    expect(joinTrackNames(["Force", "Endurance"])).toBe("Force + Endurance")
  })
})
