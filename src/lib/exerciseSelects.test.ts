import { describe, it, expect } from "vitest"

import {
  FULL_EXERCISE_SELECT,
  LABEL_EXERCISE_SELECT,
  SLIM_EXERCISE_SELECT,
} from "./exerciseSelects"

const columns = (select: string) => select.split(",").map((c) => c.trim())

const SELECTS = {
  SLIM_EXERCISE_SELECT,
  FULL_EXERCISE_SELECT,
  LABEL_EXERCISE_SELECT,
}

describe("exercise selects", () => {
  it.each(Object.entries(SELECTS))(
    "%s enumerates its columns instead of using *",
    (_name, select) => {
      expect(columns(select)).not.toContain("*")
    },
  )

  it.each(Object.entries(SELECTS))(
    "%s carries both name columns, so a label can be localized",
    (_name, select) => {
      expect(columns(select)).toEqual(
        expect.arrayContaining(["name", "name_en"]),
      )
    },
  )

  it("keeps the label projection a strict subset of the full one", () => {
    const full = new Set(columns(FULL_EXERCISE_SELECT))
    const extra = columns(LABEL_EXERCISE_SELECT).filter((c) => !full.has(c))

    expect(extra).toEqual([])
  })

  it("keeps the label projection minimal — labels only, no media or metadata", () => {
    expect(columns(LABEL_EXERCISE_SELECT).sort()).toEqual([
      "emoji",
      "equipment",
      "id",
      "muscle_group",
      "name",
      "name_en",
    ])
  })

  it("carries the taxonomy columns useCatalogLabels translates", () => {
    expect(columns(LABEL_EXERCISE_SELECT)).toEqual(
      expect.arrayContaining(["muscle_group", "equipment"]),
    )
  })
})
