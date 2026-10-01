import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { resolveMuscleGroups } from "./searchExercises.ts"

Deno.test("resolveMuscleGroups accepts Adducteurs and its EN/FR aliases", () => {
  assertEquals(resolveMuscleGroups("Adducteurs"), ["Adducteurs"])
  assertEquals(resolveMuscleGroups("adductors"), ["Adducteurs"])
  assertEquals(resolveMuscleGroups("adducteurs"), ["Adducteurs"])
})

Deno.test("Adducteurs belongs to the legs and lower_body regions", () => {
  assertEquals(resolveMuscleGroups("legs")?.includes("Adducteurs"), true)
  assertEquals(resolveMuscleGroups("lower_body")?.includes("Adducteurs"), true)
})

Deno.test("an unknown muscle group still resolves to undefined", () => {
  assertEquals(resolveMuscleGroups("Cosaque"), undefined)
})
