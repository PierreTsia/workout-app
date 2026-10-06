export type ViewLocale = 'en' | 'fr'

/**
 * Maps a BCP-47 tag onto a supported locale, or `null`.
 *
 * Mirrors `src/lib/persistedLocale.ts#normalizeLocale`, duplicated so the view stays
 * autonomous (ADR 0027: no app imports from `src/mcp-views`). Needed because the host
 * context carries the language as a tag (`"fr-FR"`), while the card's payload uses the
 * base subtag.
 */
export function normalizeLocale(language: unknown): ViewLocale | null {
  if (typeof language !== 'string') return null
  const base = language.toLowerCase().split('-')[0]
  return base === 'en' || base === 'fr' ? base : null
}

/**
 * The card's Display Locale (ADR 0031 + Display Locale). Precedence: the tool's explicit
 * argument → the **host** language (the device signal reachable from the sandboxed view,
 * which outranks the cross-device seed) → the `user_profiles.locale` seed → English.
 */
export function resolveViewLocale(
  explicitLocale: unknown,
  hostLocale: unknown,
  profileLocale: unknown,
): ViewLocale {
  return (
    normalizeLocale(explicitLocale) ??
    normalizeLocale(hostLocale) ??
    normalizeLocale(profileLocale) ??
    'en'
  )
}
