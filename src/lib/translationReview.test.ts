import { describe, it, expect } from "vitest"

import source from "./translationReview.ts?raw"
import {
  buildReviewSections,
  orphanObjections,
  type ReviewObjection,
} from "@/lib/translationReview"
import { importsOf } from "@/test/imports"
import type { ExerciseInstructions } from "@/types/database"

const french: ExerciseInstructions = {
  setup: ["Allongez-vous sur le dos.", "Écartez les mains à largeur d'épaules."],
  movement: ["Poussez la barre vers le haut."],
  breathing: ["Expirez à la poussée."],
  common_mistakes: ["Dos creusé."],
}

const english: ExerciseInstructions = {
  setup: ["Lie on your back.", "Set your hands hip-width apart."],
  movement: ["Press the bar upward."],
  breathing: ["Exhale as you press."],
  common_mistakes: ["Arched lower back."],
}

const objection: ReviewObjection = {
  section: "setup",
  index: 1,
  verdict: "measurement-changed",
  note: "'largeur des épaules' rendered as 'hip-width'",
}

describe("translationReview purity", () => {
  // The alignment is the acceptance criterion; keeping it free of React and of
  // i18next is what lets the criterion be asserted as data rather than markup.
  it.each(["react", "i18next", "@/lib/supabase", "@supabase"])(
    "does not import %s",
    (module) => {
      expect(importsOf(source, module)).toEqual([])
    },
  )
})

describe("buildReviewSections", () => {
  it("pairs French and English by index within each section", () => {
    const sections = buildReviewSections(french, english)

    expect(sections.map((entry) => entry.section)).toEqual([
      "setup",
      "movement",
      "breathing",
      "common_mistakes",
    ])
    expect(sections[0].lines).toEqual([
      {
        index: 0,
        fr: "Allongez-vous sur le dos.",
        en: "Lie on your back.",
        objections: [],
      },
      {
        index: 1,
        fr: "Écartez les mains à largeur d'épaules.",
        en: "Set your hands hip-width apart.",
        objections: [],
      },
    ])
  })

  // The acceptance criterion, at the level where it is a fact about data.
  it("hangs an objection on the sentence it named, not on the section", () => {
    const [setup] = buildReviewSections(french, english, [objection])

    expect(setup.lines[0].objections).toEqual([])
    expect(setup.lines[1].objections).toEqual([objection])
  })

  it("keeps two objections on the same sentence together", () => {
    const second: ReviewObjection = { ...objection, verdict: "register-shift" }
    const [setup] = buildReviewSections(french, english, [objection, second])

    expect(setup.lines[1].objections).toEqual([objection, second])
  })

  it("does not leak an objection across sections at the same index", () => {
    const sections = buildReviewSections(french, english, [
      { ...objection, section: "movement", index: 0 },
    ])
    const bySection = new Map(sections.map((s) => [s.section, s]))

    expect(bySection.get("setup")!.lines[0].objections).toEqual([])
    expect(bySection.get("movement")!.lines[0].objections).toHaveLength(1)
  })

  // A dropped sentence is precisely what the reviewer is looking for, so the
  // pair has to survive with a hole rather than vanish.
  it("holds a hole open when one side is shorter", () => {
    const shortened: ExerciseInstructions = { ...english, setup: ["Lie on your back."] }
    const [setup] = buildReviewSections(french, shortened)

    expect(setup.lines).toHaveLength(2)
    expect(setup.lines[1]).toEqual({
      index: 1,
      fr: "Écartez les mains à largeur d'épaules.",
      en: null,
      objections: [],
    })
  })

  it("drops sections that are empty on both sides", () => {
    const sparse: ExerciseInstructions = {
      setup: ["Allongez-vous."],
      movement: [],
      breathing: [],
      common_mistakes: [],
    }

    expect(buildReviewSections(sparse, sparse).map((s) => s.section)).toEqual([
      "setup",
    ])
  })

  it("renders the French alone when there is no translation yet", () => {
    const [setup] = buildReviewSections(french, null)

    expect(setup.lines[0]).toEqual({
      index: 0,
      fr: "Allongez-vous sur le dos.",
      en: null,
      objections: [],
    })
  })

  it("returns nothing when both sides are missing", () => {
    expect(buildReviewSections(null, null)).toEqual([])
  })
})

describe("orphanObjections", () => {
  it("finds nothing when every objection landed on a sentence", () => {
    const sections = buildReviewSections(french, english, [objection])

    expect(orphanObjections(sections, [objection])).toEqual([])
  })

  it("surfaces an objection pointing past the end of its section", () => {
    const stray: ReviewObjection = { ...objection, index: 9 }
    const sections = buildReviewSections(french, english, [stray])

    expect(orphanObjections(sections, [stray])).toEqual([stray])
  })
})
