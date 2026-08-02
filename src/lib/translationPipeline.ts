/**
 * The two decisions the translation CLI makes about a row: whether to touch it
 * at all, and what to write when it does.
 *
 * They live here, pure and tested, rather than inside the I/O loop, because
 * they are what makes the script idempotent — and idempotence is not something
 * you can demonstrate by reading a `for` loop that also does HTTP.
 */
import { INSTRUCTION_SECTIONS } from "@/lib/instructionQuality"
import { PROMPT_VERSION, type TranslationObjection } from "@/lib/instructionPrompt"
import type { ExerciseInstructions, TranslationAudit } from "@/types/database"

/** The two statuses the pipeline can write. `approved` is a human's word. */
export type PipelineStatus = "clean" | "flagged"

/** A human verdict the pipeline must never overwrite. */
const APPROVED = "approved"

export interface TranslationCandidate {
  instructions?: ExerciseInstructions | null
  instructions_en?: ExerciseInstructions | null
  instructions_en_status?: string | null
}

/** At least one step that is not blank. */
const hasContent = (block: ExerciseInstructions | null | undefined): boolean =>
  INSTRUCTION_SECTIONS.some((section) =>
    (block?.[section] ?? []).some((step) => step.trim() !== ""),
  )

/**
 * Mirrors the SQL filter the CLI selects with — `instructions IS NOT NULL AND
 * instructions_en IS NULL` — and adds the two guards the query cannot express.
 *
 * A row with no French has nothing to translate. A row a human approved is
 * never rewritten, `--force` included: `--force` exists to replay a machine
 * verdict, not to overrule a person.
 */
export function isTranslationCandidate(
  row: TranslationCandidate,
  options: { force?: boolean } = {},
): boolean {
  if (!hasContent(row.instructions)) return false
  if (row.instructions_en_status === APPROVED) return false
  return options.force === true || row.instructions_en == null
}

/**
 * `clean` only when the automated gate found nothing AND a cross-checker
 * actually answered with no objection.
 *
 * An unavailable checker — dead quota, HTTP error, unparseable verdict — yields
 * `flagged`, which renders French. A missing second opinion is not evidence of
 * quality, and English nobody checked is exactly the failure this epic exists
 * to avoid.
 */
export function deriveStatus(
  gateFlags: readonly string[],
  objections: readonly TranslationObjection[],
  checkerAvailable: boolean,
): PipelineStatus {
  return checkerAvailable && gateFlags.length === 0 && objections.length === 0
    ? "clean"
    : "flagged"
}

export interface TranslationOutcome {
  translation: ExerciseInstructions
  gateFlags: readonly string[]
  /** `null` when the cross-checker gave no usable answer. */
  objections: readonly TranslationObjection[] | null
  model: string
  checkerModel: string
  translatedAt: string
}

/** The four columns, always written together. */
export interface TranslationUpdate {
  instructions_en: ExerciseInstructions
  instructions_en_status: PipelineStatus
  instructions_en_reviewed_at: null
  instructions_en_audit: TranslationAudit
}

/**
 * One row, four columns, one update. A partial write would leave content with
 * no status, which the display resolver reads as "unknown" and renders as
 * French — a silent half-migration nobody would notice.
 *
 * `instructions_en_reviewed_at` is written as `null` on purpose: the pipeline
 * is not a review, and the review queue selects on that column being null. A
 * timestamp here would empty the queue without anyone reading a word.
 */
export function buildTranslationUpdate(
  outcome: TranslationOutcome,
): TranslationUpdate {
  const objections = outcome.objections ?? []
  const checkerAvailable = outcome.objections !== null

  return {
    instructions_en: outcome.translation,
    instructions_en_status: deriveStatus(
      outcome.gateFlags,
      objections,
      checkerAvailable,
    ),
    instructions_en_reviewed_at: null,
    instructions_en_audit: {
      model: outcome.model,
      prompt_version: PROMPT_VERSION,
      translated_at: outcome.translatedAt,
      checker_model: checkerAvailable ? outcome.checkerModel : null,
      gate_flags: [...outcome.gateFlags],
      objections: [...objections],
    },
  }
}
