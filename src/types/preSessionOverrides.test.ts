import { describe, expect, it } from "vitest"
import type { WorkoutExercise } from "@/types/database"
import {
  clonePreSessionPatch,
  deserializePreSessionPatch,
  emptyPreSessionPatch,
  serializePreSessionPatch,
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
    rep_range_min: 8,
    rep_range_max: 12,
    set_range_min: 2,
    set_range_max: 5,
    weight_increment: null,
    max_weight_reached: false,
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

describe("serializePreSessionPatch / deserializePreSessionPatch", () => {
  it("round-trips sets, map entries, and added rows", () => {
    const p = emptyPreSessionPatch()
    p.deletedIds.add("del")
    p.swappedRows.set("r1", fakeRow("r1"))
    p.addedRows.push(fakeRow("add"))

    const back = deserializePreSessionPatch(serializePreSessionPatch(p))
    expect(back.deletedIds.has("del")).toBe(true)
    expect(back.swappedRows.get("r1")?.id).toBe("r1")
    expect(back.addedRows).toHaveLength(1)
    expect(back.addedRows[0]?.id).toBe("add")
  })
})
