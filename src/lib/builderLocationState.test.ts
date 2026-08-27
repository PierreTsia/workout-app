import { describe, expect, it } from "vitest"
import { readBuilderLocationState } from "./builderLocationState"

describe("readBuilderLocationState", () => {
  it("reads a day id and back path from location state", () => {
    expect(
      readBuilderLocationState({
        from: "/programs/abc",
        dayId: "day-1",
      }),
    ).toEqual({ from: "/programs/abc", dayId: "day-1" })
  })

  it("ignores missing or empty day id so the Builder opens on the day list", () => {
    expect(readBuilderLocationState({ from: "/library/programs" })).toEqual({
      from: "/library/programs",
      dayId: undefined,
    })
    expect(readBuilderLocationState({ dayId: "" })).toEqual({
      from: undefined,
      dayId: undefined,
    })
    expect(readBuilderLocationState(null)).toEqual({})
  })
})
