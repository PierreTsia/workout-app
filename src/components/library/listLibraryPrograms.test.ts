import { describe, expect, it } from "vitest"
import { listLibraryPrograms } from "./listLibraryPrograms"

describe("listLibraryPrograms", () => {
  it("lists the active program before the others", () => {
    const listed = listLibraryPrograms([
      { id: "ppl", is_active: false },
      { id: "manuel", is_active: true },
      { id: "machines", is_active: false },
    ])

    expect(listed.map((program) => program.id)).toEqual([
      "manuel",
      "ppl",
      "machines",
    ])
  })
})
