/**
 * The clipboard round trip of the translation review screen (#417, T160).
 *
 * Pure by construction — no React, no i18next, no Supabase — so the payload the
 * reviewer pastes into an assistant and the answer they paste back are both
 * testable without rendering anything.
 */
import {
  HOUSE_RULES,
  extractJsonObject,
  parseInstructions,
} from "@/lib/instructionPrompt"
import { filledInstructionSections } from "@/lib/catalogLabels"
import {
  INSTRUCTION_SECTIONS,
  type InstructionSection,
} from "@/lib/instructionQuality"
import { buildReviewSections } from "@/lib/translationReview"
import type { ExerciseInstructions, TranslationAudit } from "@/types/database"

/**
 * The columns of a queue row the round trip reads. Declared here rather than
 * imported from the queue hook so this module stays a leaf: a lib that reaches
 * up into a hook for a type is a lib that will eventually reach up for a value.
 */
export interface ReviewSubject {
  name: string
  name_en: string | null
  instructions: ExerciseInstructions | null
  instructions_en: ExerciseInstructions | null
  instructions_en_audit: TranslationAudit | null
}

/** What a side reads as when it has no sentence at that index. */
const MISSING = "(missing)"

/**
 * The pairs, addressed exactly the way the audit addresses them.
 *
 * Aligned by `buildReviewSections`, which is what the card renders from too, so
 * the numbering the arbiter answers against is the numbering the reviewer is
 * looking at — one alignment, not two that can disagree.
 */
const pairsOf = (subject: ReviewSubject): string =>
  buildReviewSections(
    subject.instructions,
    subject.instructions_en,
    subject.instructions_en_audit?.objections ?? [],
  )
    .map(({ section, lines }) =>
      lines
        .map(({ index, fr, en, objections }) =>
          [
            `[${section} ${index}]`,
            `  FR: ${fr ?? MISSING}`,
            `  EN: ${en ?? MISSING}`,
            ...objections.map(
              ({ verdict, note }) =>
                `  OBJECTION (${verdict})${note ? `: ${note}` : ""}`,
            ),
          ].join("\n"),
        )
        .join("\n"),
    )
    .join("\n")

/**
 * The rules the translation was produced under, quoted from the prompt itself.
 *
 * The equipment clause loses the sentence naming this exercise's equipment: the
 * review queue projects eight columns and `equipment` is not one of them, and
 * the fidelity half — the half that matters to an arbiter — is the source's own
 * mentions anyway.
 */
const HOUSE_RULE_LINES: readonly string[] = [
  HOUSE_RULES.meaning,
  HOUSE_RULES.structure,
  HOUSE_RULES.detail,
  `${HOUSE_RULES.equipmentGlossary} Take the equipment from the French sentence itself, and ${HOUSE_RULES.equipmentFidelity}`,
  HOUSE_RULES.incline,
  HOUSE_RULES.anatomy,
  HOUSE_RULES.secondPerson,
  HOUSE_RULES.commonMistakes,
  HOUSE_RULES.casing,
  HOUSE_RULES.gymTerms,
  HOUSE_RULES.noInvention,
  HOUSE_RULES.fidelity,
]

/**
 * Asking for a correction, not an opinion.
 *
 * "Tell me whether this is right" comes back as prose the reviewer then has to
 * apply by hand, which is the work this whole screen exists to remove. Asking
 * for the corrected block means the answer is pasteable, and the shape is
 * spelled out because the paste is validated on exactly that shape.
 */
const REPLY_INSTRUCTION = `Correct the English above where it breaks one of the house rules or says something the French does not, and leave it alone everywhere else. Judge only the English: the French source is out of scope, even where it is wrong.

Reply with the complete corrected block as JSON — all four keys, every sentence, including the ones you did not change — and nothing else:

{
  "setup": ["..."],
  "movement": ["..."],
  "breathing": ["..."],
  "common_mistakes": ["..."]
}`

export function buildReviewRequest(subject: ReviewSubject): string {
  return `Exercise: ${subject.name}${
    subject.name_en ? ` (English: ${subject.name_en})` : ""
  }

You are a bilingual French/English strength-coaching editor. Below is a French coaching text and its machine translation into English, sentence by sentence, with the objections a second model raised against it.

## House rules the translation was produced under

${HOUSE_RULE_LINES.map((rule) => `- ${rule}`).join("\n")}

## Sentence pairs

${pairsOf(subject)}

## What to reply

${REPLY_INSTRUCTION}`
}

/**
 * Four refusals rather than one, because the reviewer's next move differs for
 * each: `unreadable` means the answer never made it onto the clipboard whole,
 * `shape` means the assistant replied with something that is not an instruction
 * block, `blanked` means it dropped a section the French fills, and `empty`
 * means it dropped all of them.
 */
export type CorrectionResult =
  | { ok: true; instructions: ExerciseInstructions }
  | { ok: false; problem: "unreadable" | "shape" | "empty" }
  | { ok: false; problem: "blanked"; sections: InstructionSection[] }

const trimmed = (sentences: readonly string[]): string[] =>
  sentences.map((sentence) => sentence.trim()).filter((sentence) => sentence !== "")

/**
 * The same repair the textarea editor makes on its way out: surrounding
 * whitespace is the assistant's formatting rather than anyone's correction, and
 * an empty entry renders as a bullet with nothing in it.
 *
 * Written out section by section, like `fromInstructionDraft`, so the result
 * cannot lose a key on the way through.
 */
const tidied = (block: ExerciseInstructions): ExerciseInstructions => ({
  setup: trimmed(block.setup),
  movement: trimmed(block.movement),
  breathing: trimmed(block.breathing),
  common_mistakes: trimmed(block.common_mistakes),
})

/**
 * The sections a block fills, in the four-section order, using the resolver's
 * own definition of "filled".
 */
const sectionsFilledBy = (
  block: ExerciseInstructions | null | undefined,
): InstructionSection[] => {
  const filled = filledInstructionSections(block)
  return INSTRUCTION_SECTIONS.filter((section) => filled.has(section))
}

/**
 * Reads a pasted answer into an instruction block, or says why it will not.
 *
 * The well-formedness verdict is `parseInstructions`' and nothing else's — the
 * same function the backfill script trusts, so "well formed" means the same
 * thing at both ends of the pipeline. `extractJsonObject` is consulted only
 * once that verdict is already "no", and only to choose the wording.
 *
 * Well formed is not sufficient, though. `resolveExerciseInstructions` renders
 * the English only when every section the French fills is filled in English
 * too, and it makes that decision silently: a correction that drops a section
 * would be written under an `approved` status and then read back as French,
 * with nothing anywhere saying why. So the French is checked against the
 * correction here, before the reviewer is ever offered the write.
 */
export function readCorrection(
  raw: string,
  french: ExerciseInstructions | null | undefined,
): CorrectionResult {
  const parsed = parseInstructions(raw)
  if (!parsed) {
    return {
      ok: false,
      problem: extractJsonObject(raw) === undefined ? "unreadable" : "shape",
    }
  }

  const instructions = tidied(parsed)
  const filled = new Set(sectionsFilledBy(instructions))
  if (filled.size === 0) return { ok: false, problem: "empty" }

  const blanked = sectionsFilledBy(french).filter(
    (section) => !filled.has(section),
  )

  return blanked.length > 0
    ? { ok: false, problem: "blanked", sections: blanked }
    : { ok: true, instructions }
}

export type DiffStatus = "unchanged" | "changed" | "added" | "removed"

export interface DiffLine {
  index: number
  /** `null` when the correction adds a sentence at this position. */
  before: string | null
  /** `null` when the correction drops it. */
  after: string | null
  status: DiffStatus
}

export interface DiffSection {
  section: InstructionSection
  lines: DiffLine[]
}

const statusOf = (before: string | null, after: string | null): DiffStatus => {
  if (before === null) return "added"
  if (after === null) return "removed"
  return before === after ? "unchanged" : "changed"
}

/**
 * What the write would change, sentence by sentence, before it is offered.
 *
 * Aligned by index rather than by a longest-common-subsequence: the request
 * asks for one English sentence per French sentence in the same order, so the
 * index *is* the identity of a sentence throughout this epic — the objections
 * in the audit address sentences that way too. A subsequence diff would find a
 * plausible mapping for a correction that broke that contract, and present an
 * insertion as a rewrite; index alignment shows the break for what it is.
 */
export function diffCorrection(
  current: ExerciseInstructions | null | undefined,
  proposed: ExerciseInstructions,
): DiffSection[] {
  return INSTRUCTION_SECTIONS.map((section) => {
    const before = current?.[section] ?? []
    const after = proposed[section]

    return {
      section,
      lines: Array.from(
        { length: Math.max(before.length, after.length) },
        (_, index): DiffLine => {
          const from = before[index] ?? null
          const to = after[index] ?? null
          return { index, before: from, after: to, status: statusOf(from, to) }
        },
      ),
    }
  })
}
