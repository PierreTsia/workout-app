import { describe, it, expect } from "vitest"

import source from "./catalogLabels.ts?raw"
import { importsOf } from "@/test/imports"
import {
  equipmentLabelKey,
  isEnglish,
  muscleLabelKey,
  resolveExerciseInstructions,
  resolveExerciseName,
  type CatalogInstructionSource,
  type CatalogNameSource,
} from "./catalogLabels"
import type { ExerciseInstructions } from "@/types/database"

const row = (overrides: Partial<CatalogNameSource> = {}): CatalogNameSource => ({
  exercise: { name: "Développé couché", name_en: "Bench Press" },
  name_snapshot: "Développé couché (snapshot)",
  ...overrides,
})

const FRENCH: ExerciseInstructions = {
  setup: ["Allonge-toi sur le banc"],
  movement: ["Pousse la barre"],
  breathing: ["Expire à la poussée"],
  common_mistakes: ["Coudes trop écartés"],
}

const ENGLISH: ExerciseInstructions = {
  setup: ["Lie back on the bench"],
  movement: ["Press the bar up"],
  breathing: ["Exhale on the push"],
  common_mistakes: ["Flared elbows"],
}

const instructionRow = (
  overrides: Partial<CatalogInstructionSource> = {},
): CatalogInstructionSource => ({
  instructions: FRENCH,
  instructions_en: ENGLISH,
  instructions_en_status: "clean",
  ...overrides,
})

describe("purity", () => {
  // The whole point of splitting the rule out of the hook is that it resolves
  // labels without a render. An import of react or i18next here would undo that
  // silently, so assert on the source rather than trust the convention.
  it.each(["react", "i18next", "@/lib/supabase"])(
    "does not import %s",
    (module) => {
      expect(importsOf(source, module)).toEqual([])
    },
  )
})

describe("resolveExerciseName", () => {
  it("prefers name_en for an English reader", () => {
    expect(resolveExerciseName(row(), "en")).toBe("Bench Press")
  })

  it("never returns name_en to a French reader", () => {
    expect(resolveExerciseName(row(), "fr")).toBe("Développé couché")
  })

  it.each(["", "   ", null, undefined])(
    "falls back to name when name_en is %o",
    (name_en) => {
      const source = row({ exercise: { name: "Développé couché", name_en } })

      expect(resolveExerciseName(source, "en")).toBe("Développé couché")
    },
  )

  it("falls back to the snapshot when the catalog row is absent", () => {
    const source = row({ exercise: null })

    expect(resolveExerciseName(source, "en")).toBe("Développé couché (snapshot)")
  })

  it("falls back to the snapshot when the catalog row carries no name", () => {
    const source = row({ exercise: { name: "  ", name_en: null } })

    expect(resolveExerciseName(source, "en")).toBe("Développé couché (snapshot)")
  })

  it("reads the set_log snapshot column too", () => {
    const source: CatalogNameSource = {
      exercise: null,
      exercise_name_snapshot: "Squat (log)",
    }

    expect(resolveExerciseName(source, "fr")).toBe("Squat (log)")
  })

  it("returns an empty string rather than throwing when nothing resolves", () => {
    expect(resolveExerciseName({ exercise: null }, "en")).toBe("")
  })

  it("trims the value it returns", () => {
    const source = row({ exercise: { name: null, name_en: "  Bench Press  " } })

    expect(resolveExerciseName(source, "en")).toBe("Bench Press")
  })

  it("treats a region-tagged English locale as English", () => {
    expect(resolveExerciseName(row(), "en-US")).toBe("Bench Press")
  })
})

describe("resolveExerciseInstructions", () => {
  it("shows the English block to an English reader when the status is clean", () => {
    expect(resolveExerciseInstructions(instructionRow(), "en")).toBe(ENGLISH)
  })

  // A half-English panel is the defect the issue reported, so parity is checked
  // on the whole block: one section short and the reader gets French throughout.
  it("falls back to French in one block when a section is missing in English", () => {
    const source = instructionRow({
      instructions_en: { ...ENGLISH, breathing: [] },
    })

    expect(resolveExerciseInstructions(source, "en")).toBe(FRENCH)
  })

  // The `hasInstructions` block the three display surfaces used to duplicate:
  // "nothing to show" is the resolver's answer, not the caller's guess.
  it("returns null when every section is empty on both sides", () => {
    const empty: ExerciseInstructions = {
      setup: [],
      movement: [],
      breathing: ["   "],
      common_mistakes: [],
    }
    const source = instructionRow({
      instructions: empty,
      instructions_en: empty,
    })

    expect(resolveExerciseInstructions(source, "en")).toBeNull()
    expect(resolveExerciseInstructions(source, "fr")).toBeNull()
  })

  it("shows the English block once a human approved it", () => {
    const source = instructionRow({ instructions_en_status: "approved" })

    expect(resolveExerciseInstructions(source, "en")).toBe(ENGLISH)
  })

  // Fail closed: anything that isn't an explicit go-ahead renders French. An
  // unknown status is the interesting row — a vocabulary added tomorrow, or a
  // typo, must not reach an English reader as English.
  it.each(["flagged", "pending", "CLEAN", "", null, undefined])(
    "renders French to an English reader when the status is %o",
    (instructions_en_status) => {
      const source = instructionRow({ instructions_en_status })

      expect(resolveExerciseInstructions(source, "en")).toBe(FRENCH)
    },
  )

  // SLIM and LABEL projections carry no status column at all; the row that
  // reaches a display surface from one of them must still read French.
  it("renders French when the status never made it into the projection", () => {
    const source: CatalogInstructionSource = {
      instructions: FRENCH,
      instructions_en: ENGLISH,
    }

    expect(resolveExerciseInstructions(source, "en")).toBe(FRENCH)
  })

  it.each(["fr", "fr-FR"])(
    "never returns the English block to a %s reader, clean status or not",
    (locale) => {
      expect(resolveExerciseInstructions(instructionRow(), locale)).toBe(FRENCH)
    },
  )

  it.each(["clean", "flagged", "approved", null, undefined])(
    "renders French identically whatever the status says (%o)",
    (instructions_en_status) => {
      const source = instructionRow({
        instructions_en: null,
        instructions_en_status,
      })

      expect(resolveExerciseInstructions(source, "en")).toBe(FRENCH)
      expect(resolveExerciseInstructions(source, "fr")).toBe(FRENCH)
    },
  )

  it("returns null rather than throwing when the row carries no instructions", () => {
    expect(resolveExerciseInstructions({}, "en")).toBeNull()
  })

  it("treats a region-tagged English locale as English", () => {
    expect(resolveExerciseInstructions(instructionRow(), "en-GB")).toBe(ENGLISH)
  })
})

describe("isEnglish", () => {
  it.each([
    ["en", true],
    ["en-US", true],
    ["EN", true],
    ["fr", false],
    ["fr-FR", false],
    [null, false],
    [undefined, false],
  ])("%o → %s", (locale, expected) => {
    expect(isEnglish(locale)).toBe(expected)
  })
})

describe("muscleLabelKey", () => {
  it("keys a canonical muscle name", () => {
    expect(muscleLabelKey("Pectoraux")).toBe("muscles.Pectoraux")
  })

  it.each(["Deltoïdes post.", "Ischios / Bas du dos", "", null, undefined])(
    "returns null for %o so the caller can render it raw",
    (value) => {
      expect(muscleLabelKey(value)).toBeNull()
    },
  )
})

describe("equipmentLabelKey", () => {
  it("keys a known slug", () => {
    expect(equipmentLabelKey("ez_bar")).toBe("equipment.ez_bar")
  })

  it.each(["smith_machine", "", null, undefined])(
    "returns null for %o",
    (slug) => {
      expect(equipmentLabelKey(slug)).toBeNull()
    },
  )
})
