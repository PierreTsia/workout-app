/**
 * Turns a translated row into the shape the review card renders: four sections,
 * French and English paired by their index inside the section, each pair
 * carrying the objections the cross-checker raised against it.
 *
 * The pairing lives here rather than in the component because "the objection
 * appears on the sentence it targeted" is the whole point of the screen, and
 * that is a claim about data, not about markup.
 */
import {
  INSTRUCTION_SECTIONS,
  type InstructionSection,
} from "@/lib/instructionQuality"
import type {
  ExerciseInstructions,
  TranslationAudit,
} from "@/types/database"

export type ReviewObjection = TranslationAudit["objections"][number]

/**
 * i18n key per section, in the `admin` namespace. Here rather than in one of
 * the two components that render section headings, so the review card and the
 * assist dialog cannot end up naming the same section differently.
 */
export const SECTION_LABEL_KEYS: Record<InstructionSection, string> = {
  setup: "translations.sections.setup",
  movement: "translations.sections.movement",
  breathing: "translations.sections.breathing",
  common_mistakes: "translations.sections.commonMistakes",
}

export interface ReviewLine {
  /** Position inside the section — what an objection points at. */
  index: number
  /** `null` when this side has no sentence at that index. */
  fr: string | null
  en: string | null
  objections: ReviewObjection[]
}

export interface ReviewSection {
  section: InstructionSection
  lines: ReviewLine[]
}

/**
 * Objections keyed by the sentence they name. A key nobody claims is a
 * hallucinated index the pipeline should already have dropped — grouping is
 * still done by lookup rather than by position so a stray one cannot shift
 * every objection after it onto the wrong sentence.
 */
const groupBySentence = (
  objections: readonly ReviewObjection[],
): Map<string, ReviewObjection[]> =>
  objections.reduce((byKey, objection) => {
    const key = `${objection.section}.${objection.index}`
    return byKey.set(key, [...(byKey.get(key) ?? []), objection])
  }, new Map<string, ReviewObjection[]>())

/**
 * The length of the longer side. A translation missing a sentence is exactly
 * what the reviewer is here to catch, so the shorter side gets a hole rather
 * than the pair being dropped.
 */
const pairedLength = (
  fr: readonly string[] | undefined,
  en: readonly string[] | undefined,
): number => Math.max(fr?.length ?? 0, en?.length ?? 0)

export function buildReviewSections(
  french: ExerciseInstructions | null | undefined,
  english: ExerciseInstructions | null | undefined,
  objections: readonly ReviewObjection[] = [],
): ReviewSection[] {
  const byKey = groupBySentence(objections)

  return INSTRUCTION_SECTIONS.map((section) => {
    const fr = french?.[section] ?? []
    const en = english?.[section] ?? []

    return {
      section,
      lines: Array.from(
        { length: pairedLength(fr, en) },
        (_, index): ReviewLine => ({
          index,
          fr: fr[index] ?? null,
          en: en[index] ?? null,
          objections: byKey.get(`${section}.${index}`) ?? [],
        }),
      ),
    }
  }).filter((entry) => entry.lines.length > 0)
}

/**
 * Objections whose index falls outside both sides of their section.
 *
 * `parseObjections` validates every index against the translation before it is
 * written, so this should always be empty — it exists so the card can say
 * "there is an objection you are not being shown" instead of swallowing it,
 * which is the failure a reviewer could never detect on their own.
 */
/** One editable text block per section, sentences separated by newlines. */
export type InstructionDraft = Record<InstructionSection, string>

/**
 * The English as plain text, one sentence per line.
 *
 * A line *is* a sentence here — that is the whole editing contract, and the
 * reason it is a transform in this module rather than a `join` buried in the
 * textarea's `value`: the round trip has to be lossless for the sentences a
 * reviewer did not touch, which is a claim worth testing on its own.
 */
export function toInstructionDraft(
  english: ExerciseInstructions | null | undefined,
): InstructionDraft {
  return Object.fromEntries(
    INSTRUCTION_SECTIONS.map((section) => [
      section,
      (english?.[section] ?? []).join("\n"),
    ]),
  ) as InstructionDraft
}

const sentencesIn = (block: string): string[] =>
  block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

/**
 * The inverse. Blank lines are dropped rather than written as empty sentences:
 * a stray return at the end of a textarea is the most likely edit of all, and
 * an empty string would render as a bullet with nothing in it.
 *
 * Written out section by section rather than mapped, so that all four keys are
 * present by construction. A partial object would fail the resolver's
 * section-parity check and the row would render French while reading
 * `approved` — and adding a fifth section would break this line rather than
 * quietly produce one.
 */
export function fromInstructionDraft(
  draft: InstructionDraft,
): ExerciseInstructions {
  return {
    setup: sentencesIn(draft.setup),
    movement: sentencesIn(draft.movement),
    breathing: sentencesIn(draft.breathing),
    common_mistakes: sentencesIn(draft.common_mistakes),
  }
}

export function orphanObjections(
  sections: readonly ReviewSection[],
  objections: readonly ReviewObjection[] = [],
): ReviewObjection[] {
  const rendered = new Set(
    sections.flatMap(({ section, lines }) =>
      lines.map(({ index }) => `${section}.${index}`),
    ),
  )

  return objections.filter(
    (objection) => !rendered.has(`${objection.section}.${objection.index}`),
  )
}
