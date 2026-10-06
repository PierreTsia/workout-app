export type ViewLocale = 'en' | 'fr'

const SUPPORTED = new Set<ViewLocale>(['en', 'fr'])

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
  return SUPPORTED.has(base as ViewLocale) ? (base as ViewLocale) : null
}

/**
 * The card's Display Locale (ADR 0031 + Display Locale): the payload's explicit locale
 * (tool argument, or the athlete's stored seed) wins, then the **host** language — the
 * only reliable device signal reachable from the sandboxed view — then English.
 */
export function resolveViewLocale(payloadLocale: unknown, hostLocale: unknown): ViewLocale {
  return normalizeLocale(payloadLocale) ?? normalizeLocale(hostLocale) ?? 'en'
}
