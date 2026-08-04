/**
 * Shared bilingual exercise-name line for MCP tool output.
 *
 * Canonical French name first, English in parentheses when present — the
 * format `search_exercises` and `resolve_exercises` already use. No locale
 * read: the agent picks the language it needs.
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

export function formatBilingualExerciseName(
  name: string,
  nameEn: string | null | undefined,
): string {
  const english = nameEn?.trim()
  return english ? `**${name}** (${english})` : `**${name}**`
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
