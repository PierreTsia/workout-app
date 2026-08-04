/**
 * Shared bilingual exercise-name line for MCP tool output.
 *
 * Canonical French name first, English in parentheses when present — the
 * format `search_exercises` and `resolve_exercises` already use. No locale
 * read: the agent picks the language it needs.
 */

export function formatBilingualExerciseName(
  name: string,
  nameEn: string | null | undefined,
): string {
  const english = nameEn?.trim()
  return english ? `**${name}** (${english})` : `**${name}**`
}

/**
 * Plain (non-markdown) variant for fields that already sit inside a bold
 * label, e.g. `**Name:** Bench Press (Développé couché)` would double-bold.
 */
export function bilingualExerciseLabel(
  name: string,
  nameEn: string | null | undefined,
): string {
  const english = nameEn?.trim()
  return english ? `${name} (${english})` : name
}
