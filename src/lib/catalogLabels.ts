/**
 * Display-time resolution of catalog labels (ADR 0010).
 *
 * The rule lives here once, as pure functions taking the locale as a parameter:
 * no React, no i18next, so it can be tested in both locales without rendering.
 * `useCatalogLabels` binds it to the current language.
 */
import { EQUIPMENT_TAXONOMY } from "@/lib/catalogTaxonomy"
import { MUSCLE_TAXONOMY } from "@/lib/trainingBalance"

/**
 * Loose on purpose: serves an embedded `workout_exercises` row (`name_snapshot`)
 * and an enriched `set_log` (`exercise_name_snapshot`) without a wrapper.
 */
export interface CatalogNameSource {
  exercise?: { name?: string | null; name_en?: string | null } | null
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
