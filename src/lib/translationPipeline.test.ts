import { describe, it, expect } from "vitest"

import source from "./translationPipeline.ts?raw"
import { importsOf } from "@/test/imports"
import { parseInstructions, type TranslationObjection } from "./instructionPrompt"
import {
  buildTranslationUpdate,
  deriveStatus,
  isTranslationCandidate,
  type TranslationOutcome,
} from "./translationPipeline"
import type { ExerciseInstructions } from "@/types/database"

const FRENCH: ExerciseInstructions = {
  setup: ["Allonge-toi sur le banc"],
  movement: ["Pousse la barre vers le haut"],
  breathing: ["Expire à la poussée"],
  common_mistakes: ["Arrondir le dos"],
}

const ENGLISH: ExerciseInstructions = {
  setup: ["Lie back on the bench"],
  movement: ["Press the bar up"],
  breathing: ["Exhale on the push"],
  common_mistakes: ["Rounding your back"],
}

const OBJECTION: TranslationObjection = {
  section: "setup",
  index: 0,
  verdict: "measurement-changed",
  note: "'largeur des épaules' rendered as hip-width",
}

const outcome = (overrides: Partial<TranslationOutcome> = {}): TranslationOutcome => ({
  translation: ENGLISH,
  gateFlags: [],
  objections: [],
  model: "gemini-2.5-flash",
  checkerModel: "llama-3.3-70b-versatile",
  translatedAt: "2026-08-02T09:12:00.000Z",
  ...overrides,
})

describe("purity", () => {
  it.each(["react", "i18next", "@/lib/supabase", "@supabase"])(
    "does not import %s",
    (module) => {
      expect(importsOf(source, module)).toEqual([])
    },
  )
})

describe("isTranslationCandidate", () => {
  it("takes a row with French and no English", () => {
    expect(
      isTranslationCandidate({ instructions: FRENCH, instructions_en: null }),
    ).toBe(true)
  })

  // The idempotence claim, in one line: a second run sees what the first one
  // wrote and has nothing to do.
  it("skips a row a previous run already translated", () => {
    expect(
      isTranslationCandidate({
        instructions: FRENCH,
        instructions_en: ENGLISH,
        instructions_en_status: "clean",
      }),
    ).toBe(false)
  })

  it("skips a row with no French to translate", () => {
    expect(isTranslationCandidate({ instructions: null })).toBe(false)
  })

  it("skips a row whose French block is present but blank", () => {
    const blank: ExerciseInstructions = {
      setup: [""],
      movement: [],
      breathing: [],
      common_mistakes: ["   "],
    }

    expect(isTranslationCandidate({ instructions: blank })).toBe(false)
  })

  it("retakes a flagged row under --force", () => {
    expect(
      isTranslationCandidate(
        {
          instructions: FRENCH,
          instructions_en: ENGLISH,
          instructions_en_status: "flagged",
        },
        { force: true },
      ),
    ).toBe(true)
  })

  it.each([{ force: true }, { force: false }])(
    "leaves an approved row alone with %o",
    (options) => {
      expect(
        isTranslationCandidate(
          {
            instructions: FRENCH,
            instructions_en: ENGLISH,
            instructions_en_status: "approved",
          },
          options,
        ),
      ).toBe(false)
    },
  )

  // A model answer that will not parse means no update is built, so the four
  // columns stay null — and a row with null columns is a candidate again.
  it("picks up again a row whose model answer was unparseable", () => {
    const untouched = { instructions: FRENCH, instructions_en: null }

    expect(parseInstructions("I could not translate this.")).toBeNull()
    expect(isTranslationCandidate(untouched)).toBe(true)
  })
})

describe("deriveStatus", () => {
  it("calls a row clean when the gate and the checker both pass", () => {
    expect(deriveStatus([], [], true)).toBe("clean")
  })

  it("flags a row the checker objected to", () => {
    expect(deriveStatus([], [OBJECTION], true)).toBe("flagged")
  })

  it("flags a row the gate caught", () => {
    expect(deriveStatus(["dropped numbers: 90"], [], true)).toBe("flagged")
  })

  // A dead quota must not mint clean English.
  it("flags a row no checker could review", () => {
    expect(deriveStatus([], [], false)).toBe("flagged")
  })
})

describe("buildTranslationUpdate", () => {
  it("writes the four columns and nothing else", () => {
    expect(Object.keys(buildTranslationUpdate(outcome())).sort()).toEqual([
      "instructions_en",
      "instructions_en_audit",
      "instructions_en_reviewed_at",
      "instructions_en_status",
    ])
  })

  it("records the models, the prompt version and the verdicts", () => {
    const update = buildTranslationUpdate(
      outcome({ gateFlags: ["dropped numbers: 90"], objections: [OBJECTION] }),
    )

    expect(update.instructions_en).toEqual(ENGLISH)
    expect(update.instructions_en_status).toBe("flagged")
    expect(update.instructions_en_audit).toEqual({
      model: "gemini-2.5-flash",
      prompt_version: 1,
      translated_at: "2026-08-02T09:12:00.000Z",
      checker_model: "llama-3.3-70b-versatile",
      gate_flags: ["dropped numbers: 90"],
      objections: [OBJECTION],
    })
  })

  // The review queue selects on `instructions_en_reviewed_at IS NULL`. Stamping
  // it here would empty the queue without a human reading a word.
  it("leaves the review timestamp null", () => {
    expect(buildTranslationUpdate(outcome()).instructions_en_reviewed_at).toBeNull()
  })

  it("records no checker model when none answered", () => {
    const update = buildTranslationUpdate(outcome({ objections: null }))

    expect(update.instructions_en_status).toBe("flagged")
    expect(update.instructions_en_audit.checker_model).toBeNull()
    expect(update.instructions_en_audit.objections).toEqual([])
  })
})
