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
