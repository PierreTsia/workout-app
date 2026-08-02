/**
 * Display-time resolution of catalog labels (ADR 0010).
 *
 * The rule lives here once, as pure functions taking the locale as a parameter:
 * no React, no i18next, so it can be tested in both locales without rendering.
 * `useCatalogLabels` binds it to the current language.
 */
import { EQUIPMENT_TAXONOMY } from "@/lib/catalogTaxonomy"
import { MUSCLE_TAXONOMY } from "@/lib/trainingBalance"
import type { ExerciseInstructions } from "@/types/database"

/**
 * `exercise` is required, though nullable — pass `exercise: null` when there is
 * genuinely no catalog row. A row that merely *forgot* the embed would resolve to
 * its snapshot and quietly serve French names to English readers, so requiring
 * the key turns that into a compile error at the call site rather than a bug on
 * screen.
 *
 * Either snapshot column satisfies it: an embedded `workout_exercises` row
 * (`name_snapshot`) and an enriched `set_log` (`exercise_name_snapshot`) both fit
 * without a wrapper.
 */
export interface CatalogNameSource {
  exercise: { name?: string | null; name_en?: string | null } | null
  name_snapshot?: string | null
  exercise_name_snapshot?: string | null
}

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * `i18n.language` can carry a region ("en-US") when it comes from the browser
 * detector, so match on the base subtag rather than on equality.
 */
export const isEnglish = (locale: string | null | undefined): boolean =>
  Boolean(locale?.toLowerCase().startsWith("en"))

/**
 * `name_en` (English readers only) → `name` → **Catalog Snapshot**.
 *
 * The snapshot is a last resort for when the catalog row is missing from the
 * query payload — never a display source, and never localized.
 */
export function resolveExerciseName(
  source: CatalogNameSource,
  locale: string,
): string {
  const english = isEnglish(locale) ? clean(source.exercise?.name_en) : null

  return (
    english ??
    clean(source.exercise?.name) ??
    clean(source.name_snapshot) ??
    clean(source.exercise_name_snapshot) ??
    ""
  )
}

/**
 * Every column the display rule reads. All optional: a row that came through a
 * projection without them (SLIM, LABEL) is a legitimate input, and the rule
 * fails closed on it rather than making the caller pre-fill nulls.
 */
export interface CatalogInstructionSource {
  instructions?: ExerciseInstructions | null
  instructions_en?: ExerciseInstructions | null
  instructions_en_status?: string | null
}

/** Statuses that clear the English block for display. Anything else is French. */
const DISPLAYABLE_EN_STATUS: ReadonlySet<string> = new Set(["clean", "approved"])

const SECTIONS = [
  "setup",
  "movement",
  "breathing",
  "common_mistakes",
] as const satisfies readonly (keyof ExerciseInstructions)[]

/**
 * Sections holding at least one step that isn't blank.
 *
 * Exported for the review screen, which refuses a pasted correction that would
 * empty a section the French fills. That guard is only worth anything if it
 * agrees with the resolver's own idea of "filled" — a second definition over
 * there could accept a block this one then renders as French.
 */
export const filledInstructionSections = (
  block: ExerciseInstructions | null | undefined,
): ReadonlySet<string> =>
  new Set(
    SECTIONS.filter((section) =>
      (block?.[section] ?? []).some((step) => clean(step)),
    ),
  )

/**
 * `instructions_en` (English readers, released status, section parity) →
 * `instructions` → `null`.
 *
 * `null` means "nothing to show", so the caller renders nothing rather than
 * re-deriving that from four array lengths — the check three surfaces used to
 * duplicate.
 *
 * The fallback is **whole-block**: an English translation missing a section the
 * French fills sends the reader back to French entirely, because a half-English
 * panel is the defect this replaces. Sentence counts are deliberately not
 * compared — a translator legitimately merges two sentences into one.
 *
 * Every other outcome fails closed to French: an unknown status, a null one, or
 * a projection that never carried the column. Blank steps count as absent, but
 * the block itself is returned untouched, so French output is byte-identical to
 * what the surfaces rendered before this rule existed.
 */
export function resolveExerciseInstructions(
  source: CatalogInstructionSource,
  locale: string,
): ExerciseInstructions | null {
  const candidate =
    isEnglish(locale) &&
    DISPLAYABLE_EN_STATUS.has(source.instructions_en_status ?? "")
      ? source.instructions_en
      : null

  const french = source.instructions ?? null
  const frenchSections = filledInstructionSections(french)
  const englishSections = filledInstructionSections(candidate)
  const hasParity = [...frenchSections].every((section) =>
    englishSections.has(section),
  )

  const resolved = candidate && hasParity ? candidate : french

  return filledInstructionSections(resolved).size > 0 ? resolved : null
}

const MUSCLES: ReadonlySet<string> = new Set(MUSCLE_TAXONOMY)
const EQUIPMENT: ReadonlySet<string> = new Set(EQUIPMENT_TAXONOMY)

/**
 * i18n key for a canonical muscle name, or `null` when the value sits outside
 * the taxonomy — which happens: `workout_exercises.muscle_snapshot` froze
 * pre-taxonomy values such as "Deltoïdes post." that no key will ever match.
 * Callers render those raw.
 */
export const muscleLabelKey = (value: string | null | undefined): string | null =>
  value && MUSCLES.has(value) ? `muscles.${value}` : null

/** i18n key for an equipment slug, or `null` when the slug is unknown. */
export const equipmentLabelKey = (
  slug: string | null | undefined,
): string | null => (slug && EQUIPMENT.has(slug) ? `equipment.${slug}` : null)
