import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"

import { isRunComplete, runCompletionSeconds, type CompletionCell } from "./blockCompletion.ts"

const cell = (over: Partial<CompletionCell>): CompletionCell => ({
  block_exercise_id: "be-1",
  set_number: 1,
  reps_logged: "10",
  duration_seconds: null,
  weight_logged: 20,
  logged_at: "2026-04-01T10:00:00Z",
  ...over,
})

Deno.test("circuit completion: wall-clock span between first and last cell", () => {
  assertEquals(
    runCompletionSeconds([
      cell({ logged_at: "2026-04-01T10:00:00Z" }),
      cell({ logged_at: "2026-04-01T10:04:00Z" }),
    ]),
    240,
  )
})

Deno.test("circuit completion: counts a full rectangle", () => {
  assertEquals(
    isRunComplete([
      cell({ block_exercise_id: "a", set_number: 1 }),
      cell({ block_exercise_id: "b", set_number: 1 }),
      cell({ block_exercise_id: "a", set_number: 2 }),
      cell({ block_exercise_id: "b", set_number: 2 }),
    ]),
    true,
  )
})

Deno.test("circuit completion: rejects a ragged or gapped run", () => {
  assertEquals(
    isRunComplete([
      cell({ block_exercise_id: "a", set_number: 1 }),
      cell({ block_exercise_id: "b", set_number: 1 }),
      cell({ block_exercise_id: "a", set_number: 2 }),
    ]),
    false,
  )
  assertEquals(
    isRunComplete([
      cell({ block_exercise_id: "a", set_number: 1 }),
      cell({ block_exercise_id: "a", set_number: 3 }),
    ]),
    false,
  )
  assertEquals(isRunComplete([]), false)
})
