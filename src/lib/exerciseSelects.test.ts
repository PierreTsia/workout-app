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

  // `useWorkoutExercises` warms the `["exercise", id]` cache from FULL and
  // `ExerciseInstructionsPanel` reads it without refetching. Drop either column
  // here and the panel opened from a session resolves French while the same
  // page opened from the library resolves English.
  it("carries the columns the instruction resolver reads", () => {
    expect(columns(FULL_EXERCISE_SELECT)).toEqual(
      expect.arrayContaining(["instructions", "instructions_en", "instructions_en_status"]),
    )
  })

  // The audit is for the review screen only, and it travels by its own RPC.
  it("leaves the translation audit out of every projection", () => {
    Object.values(SELECTS).forEach((select) => {
      expect(columns(select)).not.toContain("instructions_en_audit")
    })
  })

  it.each([SLIM_EXERCISE_SELECT, LABEL_EXERCISE_SELECT])(
    "keeps instructions out of the light projections (%s)",
    (select) => {
      expect(columns(select).filter((c) => c.startsWith("instructions"))).toEqual([])
    },
  )
})
