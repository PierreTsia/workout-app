import { describe, expect, it } from "vitest"

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

describe("circuit completion time", () => {
  it("is the wall-clock span between the first and last logged cell", () => {
    expect(
      runCompletionSeconds([
        cell({ logged_at: "2026-04-01T10:00:00Z" }),
        cell({ logged_at: "2026-04-01T10:04:00Z" }),
      ]),
    ).toBe(240)
  })

  it("counts a full rectangle (contiguous rounds, same slots each round)", () => {
    expect(
      isRunComplete([
        cell({ block_exercise_id: "a", set_number: 1 }),
        cell({ block_exercise_id: "b", set_number: 1 }),
        cell({ block_exercise_id: "a", set_number: 2 }),
        cell({ block_exercise_id: "b", set_number: 2 }),
      ]),
    ).toBe(true)
  })

  it("rejects a ragged or gapped run", () => {
    expect(
      isRunComplete([
        cell({ block_exercise_id: "a", set_number: 1 }),
        cell({ block_exercise_id: "b", set_number: 1 }),
        cell({ block_exercise_id: "a", set_number: 2 }),
      ]),
    ).toBe(false)
    expect(
      isRunComplete([
        cell({ block_exercise_id: "a", set_number: 1 }),
        cell({ block_exercise_id: "a", set_number: 3 }),
      ]),
    ).toBe(false)
    expect(isRunComplete([])).toBe(false)
  })
})
