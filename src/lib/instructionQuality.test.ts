import { describe, it, expect } from "vitest"

import source from "./instructionQuality.ts?raw"
import { importsOf } from "@/test/imports"
import {
  checkTranslation,
  gateFlags,
  moodOf,
  type TranslationSubject,
} from "./instructionQuality"
import type { ExerciseInstructions } from "@/types/database"

const block = (
  overrides: Partial<ExerciseInstructions> = {},
): ExerciseInstructions => ({
  setup: [],
  movement: [],
  breathing: [],
  common_mistakes: [],
  ...overrides,
})

const subject = (
  muscle_group: string,
  instructions: Partial<ExerciseInstructions>,
): TranslationSubject => ({ muscle_group, instructions: block(instructions) })

const BENCH_PRESS = subject("Pectoraux", {
  setup: ["Allonge-toi sur le banc, pieds au sol"],
  movement: ["Pousse la barre vers le haut"],
  breathing: ["Expire à la poussée"],
  common_mistakes: ["Arrondir le dos pendant la poussée"],
})

const BENCH_PRESS_EN = block({
  setup: ["Lie back on the bench with your feet flat on the floor"],
  movement: ["Press the bar up"],
  breathing: ["Exhale on the push"],
  common_mistakes: ["Rounding your back during the press"],
})

describe("purity", () => {
  // The gate is promoted into src/ precisely so tsc and vitest cover it. An
  // import of the Supabase client or of React would make it a module the CLI
  // cannot call and a component could ship, so assert on the source.
  it.each(["react", "i18next", "@/lib/supabase", "@supabase"])(
    "does not import %s",
    (module) => {
      expect(importsOf(source, module)).toEqual([])
    },
  )
})

describe("a faithful translation", () => {
  it("raises no flag", () => {
    expect(gateFlags(checkTranslation(BENCH_PRESS, BENCH_PRESS_EN))).toEqual([])
  })
})

describe("known false positives", () => {
  // Measured at the spike: the French names a preacher bench after Larry Scott
  // and never says "banc", so "preacher bench" looked like invented equipment
  // while being the only correct translation.
  it("accepts « pupitre Larry Scott » translated as preacher bench", () => {
    const preacherCurl = subject("Biceps", {
      setup: ["Cale tes bras sur le pupitre Larry Scott"],
      movement: ["Monte la barre EZ jusqu'aux épaules"],
      breathing: ["Expire à la montée"],
      common_mistakes: ["Décoller les coudes du support"],
    })
    const translated = block({
      setup: ["Rest your arms on the preacher bench"],
      movement: ["Curl the EZ bar up to your shoulders"],
      breathing: ["Exhale on the way up"],
      common_mistakes: ["Lifting your elbows off the pad"],
    })

    const checks = checkTranslation(preacherCurl, translated)

    expect(checks.inventedEquipment).toEqual([])
    expect(gateFlags(checks)).toEqual([])
  })

  // "Lower back" is the English label of the muscle group "Lombaires", and the
  // gate used to scan the whole block as one string: every sentence but the
  // first lost its sentence-opener exemption, so an imperative "Lower" read as
  // the muscle name in Title Case.
  it("accepts « Lower back to 90° » where lower is a verb", () => {
    const goodMorning = subject("Lombaires", {
      setup: ["Barre posée sur les trapèzes"],
      movement: ["Descends jusqu'à 90°", "Remonte en poussant les hanches vers l'avant"],
      breathing: ["Inspire à la descente"],
      common_mistakes: ["Arrondir le dos"],
    })
    const translated = block({
      setup: ["Bar resting on your traps"],
      movement: ["Lower back to 90°", "Drive your hips forward to stand up"],
      breathing: ["Inhale on the way down"],
      common_mistakes: ["Rounding your back"],
    })

    const checks = checkTranslation(goodMorning, translated)

    expect(checks.casingBleed).toBeNull()
    expect(gateFlags(checks)).toEqual([])
  })
})

describe("Unicode word boundaries", () => {
  // `\b` sits on the ASCII word class, so `\bélastique\b` never matches: the
  // term is skipped in silence and the check reports clean. These two would
  // both pass with a broken boundary, which is the whole danger.
  it("sees a French leftover that starts with an accent", () => {
    const bandKickback = subject("Fessiers", {
      movement: ["Garde l'élastique tendu"],
    })
    const translated = block({ movement: ["Keep the élastique taut"] })

    expect(checkTranslation(bandKickback, translated).frenchLeftovers).toBe(true)
  })

  it("sees an accented glossary term on the French side", () => {
    const facePull = subject("Épaules", {
      movement: ["Écarte les épaules vers l'arrière"],
    })
    const translated = block({ movement: ["Pull the blades apart"] })

    expect(
      checkTranslation(facePull, translated).glossary.map(({ term }) => term),
    ).toEqual(["épaules"])
  })

  it("does not match an accented term buried inside a longer word", () => {
    const bandKickback = subject("Fessiers", {
      movement: ["Garde l'élastique tendu"],
    })
    const translated = block({ movement: ["Move élastiquement through the rep"] })

    expect(checkTranslation(bandKickback, translated).frenchLeftovers).toBe(false)
  })
})

describe("checks", () => {
  it("flags a section that lost an entry", () => {
    const checks = checkTranslation(
      subject("Dos", { movement: ["Tire la barre", "Contrôle la descente"] }),
      block({ movement: ["Pull the bar and control the way down"] }),
    )

    expect(checks.lengthParity).toBe(false)
    // Sentence i ↔ sentence i no longer holds, so the glossary stands down.
    expect(checks.glossary).toEqual([])
    expect(gateFlags(checks)).toContain("length drift")
  })

  it("flags a dropped number", () => {
    const checks = checkTranslation(
      subject("Abdos", { breathing: ["Tiens la position 1-2 secondes"] }),
      block({ breathing: ["Hold the position briefly"] }),
    )

    expect(checks.droppedNumbers).toEqual(["1", "2"])
  })

  it("flags equipment the French never mentions", () => {
    const checks = checkTranslation(
      subject("Pectoraux", { setup: ["Allonge-toi et pousse"] }),
      block({ setup: ["Lie down on the machine and press"] }),
    )

    expect(checks.inventedEquipment).toEqual(["machine"])
  })

  it("flags a muscle name left in French", () => {
    const checks = checkTranslation(
      subject("Fessiers", { movement: ["Serre les fessiers en haut"] }),
      block({ movement: ["Squeeze your fessiers at the top"] }),
    )

    expect(checks.untranslatedMuscle).toBe(true)
  })

  it("flags a Title Case label bleeding mid-sentence", () => {
    const checks = checkTranslation(
      subject("Fessiers", { movement: ["Serre les fessiers en haut"] }),
      block({ movement: ["Squeeze your Glutes at the top"] }),
    )

    expect(checks.casingBleed).toBe("Glutes")
  })

  it("flags a glossary term swapped for the one it is confused with", () => {
    const checks = checkTranslation(
      subject("Épaules", { setup: ["Prends la barre à largeur d'épaules"] }),
      block({ setup: ["Grip the bar at shoulder-blade width"] }),
    )

    expect(checks.glossary).toEqual([
      expect.objectContaining({ section: "setup", index: 0, term: "épaules" }),
    ])
  })

  it("flags a common mistake that reads as an order", () => {
    const checks = checkTranslation(
      subject("Dos", { common_mistakes: ["Arrondir le dos pendant le tirage"] }),
      block({ common_mistakes: ["Round your back during the pull"] }),
    )

    expect(checks.imperativeMistakes).toEqual([
      { sentence: "Round your back during the pull", mood: "imperative" },
    ])
  })

  it("flags a French anatomical calque", () => {
    const checks = checkTranslation(
      subject("Abdos", { setup: ["Rétroversion du bassin"] }),
      block({ setup: ["Start with a retroversion of the pelvis"] }),
    )

    expect(checks.calques).toEqual(["retroversion"])
  })

  it("flags reps the French never prescribed", () => {
    const checks = checkTranslation(
      subject("Biceps", { movement: ["Monte la barre"] }),
      block({ movement: ["Do 3 sets of 10 curls"] }),
    )

    expect(checks.prescribesReps).toBe(true)
  })

  it("measures the second-person ratio without flagging it", () => {
    const checks = checkTranslation(
      subject("Dos", { movement: ["Garde le dos droit", "Pousse les hanches"] }),
      block({ movement: ["Keep your back flat", "Drive the hips forward"] }),
    )

    expect(checks.person).toEqual({ total: 2, yours: 1 })
    expect(gateFlags(checks)).toEqual([])
  })

  it("reports no second-person ratio when no body part is named", () => {
    const checks = checkTranslation(
      subject("Abdos", { breathing: ["Respire calmement"] }),
      block({ breathing: ["Breathe calmly"] }),
    )

    expect(checks.person).toBeNull()
  })
})

describe("moodOf", () => {
  it.each([
    ["Rounding your back during the pull", "noun-phrase"],
    ["Round your back during the pull", "imperative"],
    ["Jerk: pushing only with your arms", "noun-phrase"],
    ["Excessive weight on the first set", "unclassified"],
  ])("reads %o as %s", (sentence, mood) => {
    expect(moodOf(sentence)).toBe(mood)
  })
})
