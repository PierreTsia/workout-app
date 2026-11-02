/**
 * Catalog-name embed helpers for MCP tool output.
 *
 * The bilingual `**FR** (EN)` formatter is retired (ADR 0035): output is
 * localized through `displayLabels.resolveDisplayName`. What remains here is
 * the PostgREST embed unwrapper and the plain (non-markdown) label used by
 * `get_exercise_details`, which still shows both names.
 */

export type CatalogNameEmbed = {
  name: string
  name_en: string | null
}

/**
 * PostgREST returns a many-to-one embed as an object at runtime, but the
 * generated Supabase typings often type it as `T[]`. Accept both and take the
 * first row when it arrives as an array.
 */
export function unwrapCatalogNameEmbed(
  embed: CatalogNameEmbed | CatalogNameEmbed[] | null | undefined,
): CatalogNameEmbed | null {
  if (embed == null) return null
  if (Array.isArray(embed)) return embed[0] ?? null
  return embed
}

/**
 * Plain (non-markdown) variant for fields that already sit inside a bold
 * label, e.g. `**Name:** Développé couché (Bench Press)` would double-bold.
 */
export function bilingualExerciseLabel(
  name: string,
  nameEn: string | null | undefined,
): string {
  const english = nameEn?.trim()
  return english ? `${name} (${english})` : name
}
