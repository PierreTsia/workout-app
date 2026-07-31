import { describe, it, expect } from "vitest"

import source from "./catalogLabels.ts?raw"
import { importsOf } from "@/test/imports"
import {
  equipmentLabelKey,
  isEnglish,
  muscleLabelKey,
  resolveExerciseName,
  type CatalogNameSource,
} from "./catalogLabels"

const row = (overrides: Partial<CatalogNameSource> = {}): CatalogNameSource => ({
  exercise: { name: "Développé couché", name_en: "Bench Press" },
  name_snapshot: "Développé couché (snapshot)",
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
