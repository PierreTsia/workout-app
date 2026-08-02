import { describe, it, expect } from "vitest"

import source from "./instructionPrompt.ts?raw"
import { importsOf } from "@/test/imports"
import {
  PROMPT_VERSION,
  buildPrompt,
  buildReviewPrompt,
  parseInstructions,
  parseObjections,
  type PromptSubject,
} from "./instructionPrompt"
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

const SUBJECT: PromptSubject = {
  name: "Développé couché",
  name_en: "Bench Press",
  muscle_group: "Pectoraux",
  equipment: "barbell",
  instructions: FRENCH,
}

describe("purity", () => {
  it.each(["react", "i18next", "@/lib/supabase", "@supabase"])(
    "does not import %s",
    (module) => {
      expect(importsOf(source, module)).toEqual([])
    },
  )
})

describe("buildPrompt", () => {
  it("stamps a version the audit can be diffed against", () => {
    expect(PROMPT_VERSION).toBeGreaterThan(0)
  })

  it("passes the canonical labels in lowercase", () => {
    const { system, user } = buildPrompt(SUBJECT)

    // Title Case in the prompt is what taught the model to write "Chest" in the
    // middle of a sentence, which the gate then flags as casing bleed.
    expect(system).toContain('The target muscle is "chest"')
    expect(system).toContain('This exercise\'s equipment is "barbell"')
    expect(user).toContain("Muscle group: Pectoraux (English: Chest)")
  })

  it("names the exercise in English and carries the source block", () => {
    const { system, user } = buildPrompt(SUBJECT)

    expect(system).toContain('Refer to the exercise as "Bench Press"')
    expect(user).toContain("Allonge-toi sur le banc")
  })

  it("falls back to the French name when there is no English one", () => {
    const { system } = buildPrompt({ ...SUBJECT, name_en: null })

    expect(system).toContain('Refer to the exercise as "Développé couché"')
  })
})

describe("parseInstructions", () => {
  it("reads a valid block", () => {
    expect(parseInstructions(JSON.stringify(ENGLISH))).toEqual(ENGLISH)
  })

  it("reads a block wrapped in prose", () => {
    const raw = `Sure! Here is the translation:\n\`\`\`json\n${JSON.stringify(ENGLISH)}\n\`\`\`\nHope this helps.`

    expect(parseInstructions(raw)).toEqual(ENGLISH)
  })

  it("rejects invalid JSON", () => {
    expect(parseInstructions('{"setup": ["Lie back",}')).toBeNull()
  })

  it("rejects an incomplete shape", () => {
    const { breathing: _breathing, ...missingSection } = ENGLISH

    expect(parseInstructions(JSON.stringify(missingSection))).toBeNull()
  })

  it("rejects a section holding something other than strings", () => {
    const raw = JSON.stringify({ ...ENGLISH, movement: [{ text: "Press up" }] })

    expect(parseInstructions(raw)).toBeNull()
  })

  it.each([null, undefined, "", "no json at all"])(
    "rejects %o",
    (raw) => {
      expect(parseInstructions(raw)).toBeNull()
    },
  )
})

describe("buildReviewPrompt", () => {
  it("aligns every pair under its section and index", () => {
    const { user } = buildReviewPrompt(SUBJECT, ENGLISH)

    expect(user).toContain("[setup 0]\n  FR: Allonge-toi sur le banc\n  EN: Lie back on the bench")
    expect(user).toContain("[common_mistakes 0]")
  })

  it("skips a French sentence the translation has no counterpart for", () => {
    const truncated: ExerciseInstructions = { ...ENGLISH, movement: [] }

    expect(buildReviewPrompt(SUBJECT, truncated).user).not.toContain("[movement 0]")
  })

  it("keeps the reviewer off the French source", () => {
    expect(buildReviewPrompt(SUBJECT, ENGLISH).system).toContain(
      "Never comment on the French itself",
    )
  })
})

describe("parseObjections", () => {
  const objection = {
    section: "setup",
    index: 0,
    verdict: "measurement-changed",
    note: "'largeur des épaules' rendered as hip-width",
  }

  it("reads a verdict", () => {
    expect(parseObjections(JSON.stringify({ objections: [objection] }), ENGLISH)).toEqual([
      objection,
    ])
  })

  it("reads an empty verdict as no objection, not as no answer", () => {
    expect(parseObjections('{"objections": []}', ENGLISH)).toEqual([])
  })

  it("reads a verdict wrapped in prose", () => {
    const raw = `Here you go:\n${JSON.stringify({ objections: [objection] })}`

    expect(parseObjections(raw, ENGLISH)).toHaveLength(1)
  })

  // `null` is the signal that no checker answered, which the status derivation
  // turns into `flagged`. Returning `[]` here would mint a clean row out of a
  // broken response.
  it.each(['{"verdicts": []}', "not json", "", null, undefined])(
    "returns null for %o",
    (raw) => {
      expect(parseObjections(raw, ENGLISH)).toBeNull()
    },
  )

  it("drops an objection pointing at a sentence that does not exist", () => {
    const raw = JSON.stringify({
      objections: [objection, { ...objection, index: 7 }, { ...objection, section: "warmup" }],
    })

    expect(parseObjections(raw, ENGLISH)).toEqual([objection])
  })

  it("drops an objection with no verdict", () => {
    const raw = JSON.stringify({ objections: [{ section: "setup", index: 0, note: "hm" }] })

    expect(parseObjections(raw, ENGLISH)).toEqual([])
  })
})
