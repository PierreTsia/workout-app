import { describe, it, expect } from "vitest"

import source from "./reviewAssist.ts?raw"
import { importsOf } from "@/test/imports"
import {
  buildReviewRequest,
  diffCorrection,
  readCorrection,
  type ReviewSubject,
} from "./reviewAssist"
import { buildPrompt, type PromptSubject } from "@/lib/instructionPrompt"
import type { ExerciseInstructions, TranslationAudit } from "@/types/database"

const FRENCH: ExerciseInstructions = {
  setup: [
    "Allongez-vous sur le banc.",
    "Écartez les mains à largeur d'épaules.",
  ],
  movement: ["Poussez la barre vers le haut."],
  breathing: ["Expirez à la poussée."],
  common_mistakes: ["Dos creusé."],
}

const ENGLISH: ExerciseInstructions = {
  setup: ["Lie back on the bench.", "Set your hands hip-width apart."],
  movement: ["Press the bar upward."],
  breathing: ["Exhale as you press."],
  common_mistakes: ["Arched lower back."],
}

const AUDIT: TranslationAudit = {
  model: "gemini-2.5-flash",
  prompt_version: 1,
  translated_at: "2026-08-02T12:26:44.264Z",
  checker_model: "llama-3.3-70b-versatile",
  gate_flags: ["calques: lumbar"],
  objections: [
    {
      section: "setup",
      index: 1,
      verdict: "measurement-changed",
      note: "'largeur des épaules' rendered as 'hip-width'",
    },
  ],
}

/** The same movement, seen by the translation prompt, which needs two more columns. */
const PROMPT_SUBJECT: PromptSubject = {
  name: "Développé couché",
  name_en: "Bench Press",
  muscle_group: "Pectoraux",
  equipment: "barbell",
  instructions: FRENCH,
}

const makeSubject = (overrides: Partial<ReviewSubject> = {}): ReviewSubject => ({
  name: "Développé couché",
  name_en: "Bench Press",
  instructions: FRENCH,
  instructions_en: ENGLISH,
  instructions_en_audit: null,
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

describe("buildReviewRequest", () => {
  it("names the movement in both languages", () => {
    const request = buildReviewRequest(makeSubject())

    expect(request).toContain("Développé couché")
    expect(request).toContain("Bench Press")
  })

  // The answer has to be realignable without guessing, so every sentence
  // carries the address the audit already uses: section plus index.
  it("numbers every sentence and pairs it with its French source", () => {
    const request = buildReviewRequest(makeSubject())

    expect(request).toContain(
      "[setup 1]\n  FR: Écartez les mains à largeur d'épaules.\n  EN: Set your hands hip-width apart.",
    )
    expect(request).toContain(
      "[common_mistakes 0]\n  FR: Dos creusé.\n  EN: Arched lower back.",
    )
  })

  // A dropped sentence is the defect most worth adjudicating, so the pair is
  // still emitted with the hole named rather than silently skipped — which is
  // where this differs from the cross-check prompt, whose job is only to judge
  // pairs that exist.
  it("shows the hole when one side has no sentence at that index", () => {
    const request = buildReviewRequest(
      makeSubject({ instructions_en: { ...ENGLISH, setup: ENGLISH.setup.slice(0, 1) } }),
    )

    expect(request).toContain(
      "[setup 1]\n  FR: Écartez les mains à largeur d'épaules.\n  EN: (missing)",
    )
  })

  // The objection is what makes this an adjudication rather than a re-read, and
  // it has to sit on the sentence it names — the same claim the card makes on
  // screen, restated in text the arbiter reads top to bottom.
  it("attaches the cross-checker's objection to the sentence it named", () => {
    const request = buildReviewRequest(makeSubject({ instructions_en_audit: AUDIT }))

    expect(request).toContain(
      "[setup 1]\n  FR: Écartez les mains à largeur d'épaules.\n  EN: Set your hands hip-width apart.\n  OBJECTION (measurement-changed): 'largeur des épaules' rendered as 'hip-width'",
    )
    expect(request).not.toContain(
      "[setup 0]\n  FR: Allongez-vous sur le banc.\n  EN: Lie back on the bench.\n  OBJECTION",
    )
  })

  // An arbiter judging by different rules than the translator was given
  // "corrects" faithful sentences: an imperative under common_mistakes reads
  // like better English until you remember it tells the reader to commit the
  // fault. So the request has to quote the rules, not paraphrase them — and
  // asserting the same fragment on both sides is what fails if either drifts.
  it.each([
    "MUST stay a noun phrase in English",
    "Address the reader in the second person throughout",
    "Preserve EVERY concrete detail",
    "do not introduce equipment the French source does not mention",
    "Do not add, remove, soften or improve any cue",
  ])("states the translation prompt's own rule: %s", (rule) => {
    expect(buildReviewRequest(makeSubject())).toContain(rule)
    expect(buildPrompt(PROMPT_SUBJECT).system).toContain(rule)
  })

  // "Tell me if this is right" comes back as prose the reviewer then applies by
  // hand, which is the work the screen exists to remove. The request has to ask
  // for something pasteable, in the shape the paste is validated against.
  it("asks for the whole corrected block as JSON rather than for an opinion", () => {
    const request = buildReviewRequest(makeSubject())

    expect(request).toMatch(/Reply with the complete corrected block as JSON/)
    expect(request).toContain("and nothing else")
    expect(request).toContain('"common_mistakes": ["..."]')
  })

  // The queue can hand over a row with no English at all, or no audit: the
  // request is still the fastest way to get one, so it must not throw.
  it("builds for a row with no translation and no audit", () => {
    const request = buildReviewRequest(
      makeSubject({ name_en: null, instructions_en: null }),
    )

    expect(request).toContain("Exercise: Développé couché")
    expect(request).not.toContain("(English:")
    expect(request).toContain("[setup 0]\n  FR: Allongez-vous sur le banc.\n  EN: (missing)")
  })
})

describe("readCorrection", () => {
  it("reads a corrected block the assistant wrapped in prose and a fence", () => {
    const corrected = {
      ...ENGLISH,
      setup: ["Lie back on the bench.", "Set your hands shoulder-width apart."],
    }
    const raw = `Sure — here is the corrected JSON:\n\`\`\`json\n${JSON.stringify(corrected)}\n\`\`\`\nLet me know if you want more.`

    expect(readCorrection(raw, FRENCH)).toEqual({
      ok: true,
      instructions: corrected,
    })
  })

  // Two different mistakes for the reviewer: one means "you did not copy the
  // whole block", the other means "the assistant answered something that is not
  // an instruction block". Telling them apart is the difference between a
  // message they can act on and one they can only stare at.
  //
  // The trailing comma is the awkward one: `["Lie back"]` inside it is perfectly
  // good JSON on its own, and an extractor that goes looking for any parseable
  // structure finds it and reports a syntax error as a shape problem.
  it.each([
    ["a trailing comma", '{"setup": ["Lie back"],}'],
    ["smart quotes around the keys", '{\u201Csetup\u201D: [\u201CLie back\u201D]}'],
    ["a truncated answer", '{"setup": ["Lie back", "Set your'],
    ["no JSON at all", "Yes, the translation looks fine to me."],
    ["an unterminated array", '["Lie back on the bench.", "Set your'],
  ])("refuses %s as unreadable", (_case, raw) => {
    expect(readCorrection(raw, FRENCH)).toEqual({ ok: false, problem: "unreadable" })
  })

  // The line between the two refusals is `JSON.parse`, and nothing else. A
  // reviewer told "that is not valid JSON" about something that demonstrably
  // is goes looking for a syntax error that does not exist; every one of these
  // parsed fine and simply is not an instruction block, which is a different
  // sentence and a different next move.
  it.each([
    ["a bare array of sentences", '["Lie back on the bench.", "Press upward."]'],
    ["an array of blocks", '[{"setup": [], "movement": []}]'],
    ["a fenced array", '```json\n["Lie back on the bench."]\n```'],
    ["a bare string", '"The translation looks fine to me."'],
    ["a number", "42"],
    ["a boolean", "true"],
    ["a literal null", "null"],
  ])("refuses %s as the wrong shape, not as unreadable", (_case, raw) => {
    expect(readCorrection(raw, FRENCH)).toEqual({ ok: false, problem: "shape" })
  })

  // Well-formed JSON saying the wrong thing is the dangerous half: it looks
  // like an answer. Every one of these would write a block the resolver reads
  // as partial, and the row would render French under an `approved` status.
  it.each([
    ["a missing section", { ...ENGLISH, breathing: undefined }],
    ["a section renamed", { ...ENGLISH, breathing: undefined, breath: ENGLISH.breathing }],
    ["a string where the array belongs", { ...ENGLISH, movement: "Press the bar upward." }],
    ["a nested array", { ...ENGLISH, movement: [["Press the bar upward."]] }],
    ["a number", { ...ENGLISH, movement: [90] }],
    ["a null", { ...ENGLISH, movement: [null] }],
    ["an object", { ...ENGLISH, movement: [{ text: "Press the bar upward." }] }],
    ["a null section", { ...ENGLISH, movement: null }],
  ])("refuses %s as the wrong shape", (_case, body) => {
    expect(readCorrection(JSON.stringify(body), FRENCH)).toEqual({
      ok: false,
      problem: "shape",
    })
  })

  // A field the assistant added is not a reason to make the reviewer go back
  // and ask again — but it must not reach the column either, where nothing
  // would ever read it and the next diff would show it as content.
  it("drops a field the assistant invented rather than writing it", () => {
    const raw = JSON.stringify({
      ...ENGLISH,
      notes: "I fixed the hip-width one.",
      confidence: 0.9,
    })

    expect(readCorrection(raw, FRENCH)).toEqual({ ok: true, instructions: ENGLISH })
  })

  // Same repair the textarea editor makes: a blank entry would render as a
  // bullet with nothing in it, and leading whitespace is an artefact of the
  // assistant's formatting, not a correction anyone made.
  it("trims each sentence and drops the blank ones", () => {
    const raw = JSON.stringify({
      ...ENGLISH,
      movement: ["  Press the bar upward.  ", "", "   "],
    })

    expect(readCorrection(raw, FRENCH)).toEqual({
      ok: true,
      instructions: { ...ENGLISH, movement: ["Press the bar upward."] },
    })
  })

  // The failure the whole ticket is guarding against. Every key is present and
  // every entry is a string, so the shape validator is satisfied — but the
  // resolver requires a section the French fills to be filled in English, and a
  // row written like this reads `approved` while rendering French. Nothing
  // downstream would ever say so.
  it("refuses a correction that empties a section the French fills", () => {
    const raw = JSON.stringify({ ...ENGLISH, breathing: [], common_mistakes: [""] })

    expect(readCorrection(raw, FRENCH)).toEqual({
      ok: false,
      problem: "blanked",
      sections: ["breathing", "common_mistakes"],
    })
  })

  // Parity runs one way only, exactly as the resolver checks it: a French
  // section nobody wrote does not oblige the English to invent one.
  it("accepts an empty section when the French has nothing there either", () => {
    const french = { ...FRENCH, breathing: [] }
    const raw = JSON.stringify({ ...ENGLISH, breathing: [] })

    expect(readCorrection(raw, french)).toEqual({
      ok: true,
      instructions: { ...ENGLISH, breathing: [] },
    })
  })

  it("refuses a block with nothing left in it at all", () => {
    const raw = JSON.stringify({
      setup: [],
      movement: [],
      breathing: [],
      common_mistakes: [],
    })

    expect(readCorrection(raw, null)).toEqual({ ok: false, problem: "empty" })
  })
})

describe("diffCorrection", () => {
  it("says which sentence changed, and to what", () => {
    const proposed = {
      ...ENGLISH,
      setup: ["Lie back on the bench.", "Set your hands shoulder-width apart."],
    }

    expect(diffCorrection(ENGLISH, proposed)).toContainEqual({
      section: "setup",
      lines: [
        {
          index: 0,
          before: "Lie back on the bench.",
          after: "Lie back on the bench.",
          status: "unchanged",
        },
        {
          index: 1,
          before: "Set your hands hip-width apart.",
          after: "Set your hands shoulder-width apart.",
          status: "changed",
        },
      ],
    })
  })

  // A correction that splits or merges a sentence changes the count, and that
  // is the one thing the reviewer most needs to see before writing: the count
  // is what the objections are addressed by.
  it("marks a sentence the correction adds and one it drops", () => {
    const proposed = {
      ...ENGLISH,
      movement: ["Press the bar upward.", "Lock your elbows out."],
      common_mistakes: [],
    }

    const lines = (section: string) =>
      diffCorrection(ENGLISH, proposed).find((entry) => entry.section === section)
        ?.lines

    expect(lines("movement")).toContainEqual({
      index: 1,
      before: null,
      after: "Lock your elbows out.",
      status: "added",
    })
    expect(lines("common_mistakes")).toContainEqual({
      index: 0,
      before: "Arched lower back.",
      after: null,
      status: "removed",
    })
  })

  // No phantom changes: a reviewer who is shown a highlighted line that is not
  // actually a change learns to stop reading the highlights, and the diff is
  // the only thing standing between a bad paste and the catalogue.
  it("reports no change at all when the correction is the current text", () => {
    const diff = diffCorrection(ENGLISH, ENGLISH)

    expect(
      diff.flatMap(({ lines }) => lines).every(({ status }) => status === "unchanged"),
    ).toBe(true)
  })
})
