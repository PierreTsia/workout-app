import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"

import { loadedSetKg, sessionTonnageKg, type TonnageSet } from "./tonnage.ts"

const set = (over: Partial<TonnageSet>): TonnageSet => ({
  reps_logged: "8",
  duration_seconds: null,
  weight_logged: 60,
  ...over,
})

Deno.test("tonnage: counts loaded iron: weight × numeric reps", () => {
  assertEquals(loadedSetKg(set({ weight_logged: 60, reps_logged: "8" })), 480)
})

Deno.test("tonnage: excludes duration holds, bodyweight and non-numeric reps", () => {
  assertEquals(loadedSetKg(set({ duration_seconds: 45, weight_logged: 60 })), 0)
  assertEquals(loadedSetKg(set({ weight_logged: 0 })), 0)
  assertEquals(loadedSetKg(set({ reps_logged: "8-12" })), 0)
  assertEquals(loadedSetKg(set({ reps_logged: "" })), 0)
  assertEquals(loadedSetKg(set({ reps_logged: null })), 0)
})

Deno.test("tonnage: sums a session", () => {
  assertEquals(
    sessionTonnageKg([
      set({ weight_logged: 60, reps_logged: "8" }),
      set({ weight_logged: 100, reps_logged: "5" }),
      set({ weight_logged: 60, duration_seconds: 30 }),
    ]),
    980,
  )
})
