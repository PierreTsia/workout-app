import { describe, expect, it } from "vitest"
import type { WorkoutExercise } from "@/types/database"
import {
  clonePreSessionPatch,
  emptyPreSessionPatch,
} from "@/types/preSessionOverrides"

function fakeRow(id: string): WorkoutExercise {
  return {
    id,
    workout_day_id: "d",
    exercise_id: "e",
    name_snapshot: "X",
    muscle_snapshot: "m",
    emoji_snapshot: "🏋️",
    sets: 3,
    reps: "10",
    weight: "0",
    rest_seconds: 60,
    sort_order: 0,
  }
}

describe("emptyPreSessionPatch", () => {
  it("returns independent empty structures", () => {
    const a = emptyPreSessionPatch()
    const b = emptyPreSessionPatch()
    a.deletedIds.add("x")
    expect(b.deletedIds.size).toBe(0)
  })
})

describe("clonePreSessionPatch", () => {
  it("deep-copies sets, maps, and added rows array", () => {
    const original = emptyPreSessionPatch()
    original.deletedIds.add("1")
    original.swappedRows.set("r1", fakeRow("r1"))
    original.addedRows.push(fakeRow("add"))

    const copy = clonePreSessionPatch(original)
    expect(copy.deletedIds.has("1")).toBe(true)
    expect(copy.swappedRows.get("r1")?.name_snapshot).toBe("X")
    expect(copy.addedRows).toHaveLength(1)

    copy.deletedIds.delete("1")
    copy.swappedRows.clear()
    copy.addedRows.pop()

    expect(original.deletedIds.has("1")).toBe(true)
    expect(original.swappedRows.size).toBe(1)
    expect(original.addedRows).toHaveLength(1)
  })
})
