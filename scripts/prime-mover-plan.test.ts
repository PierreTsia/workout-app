import { describe, expect, it } from "vitest"
import {
  DAY_SLOTS,
  PROGRAM_NAME,
  SESSION_PREFIX,
  buildSessionPlan,
  estimated1rm,
  sessionWindow,
} from "./prime-mover-plan"

describe("prime-mover-plan", () => {
  it("keeps the Tour program name + session prefix stable", () => {
    expect(PROGRAM_NAME).toBe("Echo Strength — 3×")
    expect(SESSION_PREFIX).toBe("Prime Mover")
  })

  it("plans 5 weeks × 3 days with progression tags on the newest week", () => {
    const plan = buildSessionPlan(new Date("2026-08-11T12:00:00.000Z"))
    expect(plan).toHaveLength(15)

    const tagged = plan.filter((s) => s.progressionTag)
    expect(tagged).toHaveLength(3)
    expect(tagged.map((s) => [s.dayKey, s.progressionTag])).toEqual([
      ["push", "weight_up"],
      ["pull", "hold"],
      ["legs", "plateau"],
    ])
  })

  it("stages WEIGHT_UP as top-of-range reps with comfortable RIR on OHP", () => {
    const push = buildSessionPlan().find((s) => s.progressionTag === "weight_up")
    expect(push).toBeDefined()
    const ohp = push!.slots[1]!
    const template = DAY_SLOTS.push[1]!
    expect(template.exerciseName).toMatch(/épaules|haltères/i)
    expect(ohp.every((s) => s.reps >= template.repRangeMax)).toBe(true)
    expect(ohp.every((s) => (s.rir ?? 0) >= 2)).toBe(true)
  })

  it("stages HOLD as grinding RIR on pulldown", () => {
    const pull = buildSessionPlan().find((s) => s.progressionTag === "hold")
    expect(pull).toBeDefined()
    const pulldown = pull!.slots[0]!
    expect(pulldown.some((s) => (s.rir ?? 99) < 1)).toBe(true)
  })

  it("stages PLATEAU as max-reps at ceiling weight on squat", () => {
    const legs = buildSessionPlan().find((s) => s.progressionTag === "plateau")
    expect(legs).toBeDefined()
    const squat = legs!.slots[0]!
    const template = DAY_SLOTS.legs[0]!
    expect(template.maxWeightReached).toBe(true)
    expect(squat.every((s) => s.reps >= template.repRangeMax)).toBe(true)
    expect(squat.every((s) => s.weight === template.weight)).toBe(true)
  })

  it("computes Epley e1RM and session windows", () => {
    expect(estimated1rm(100, 5)).toBe(116.7)
    expect(estimated1rm(0, 5)).toBeNull()
    const { started_at, finished_at } = sessionWindow(
      2,
      17,
      60,
      new Date("2026-08-11T12:00:00.000Z"),
    )
    expect(started_at).toBe("2026-08-09T17:15:00.000Z")
    expect(finished_at).toBe("2026-08-09T18:15:00.000Z")
  })
})
