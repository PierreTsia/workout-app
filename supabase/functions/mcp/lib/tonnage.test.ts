import { describe, expect, it } from "vitest"

import { loadedSetKg, sessionTonnageKg, type TonnageSet } from "./tonnage.ts"

const set = (over: Partial<TonnageSet>): TonnageSet => ({
  reps_logged: "8",
  duration_seconds: null,
  weight_logged: 60,
  ...over,
})

describe("tonnage", () => {
  it("counts loaded iron: weight × numeric reps", () => {
    expect(loadedSetKg(set({ weight_logged: 60, reps_logged: "8" }))).toBe(480)
  })

  it("excludes duration holds, bodyweight (0 kg) and non-numeric reps", () => {
    expect(loadedSetKg(set({ duration_seconds: 45, weight_logged: 60 }))).toBe(0)
    expect(loadedSetKg(set({ weight_logged: 0 }))).toBe(0)
    expect(loadedSetKg(set({ reps_logged: "8-12" }))).toBe(0)
    expect(loadedSetKg(set({ reps_logged: "" }))).toBe(0)
    expect(loadedSetKg(set({ reps_logged: null }))).toBe(0)
  })

  it("sums a session", () => {
    expect(
      sessionTonnageKg([
        set({ weight_logged: 60, reps_logged: "8" }),
        set({ weight_logged: 100, reps_logged: "5" }),
        set({ weight_logged: 60, duration_seconds: 30 }),
      ]),
    ).toBe(980)
  })
})
