/**
 * Bridge between jotai's `atomWithStorage` (which JSON-stringifies values)
 * and i18next-browser-languagedetector (which reads raw strings). Both
 * write to the same `localStorage["locale"]` key but with different
 * encodings, so without this helper i18n boot detection misses the user's
 * persisted preference and falls back to navigator language.
 *
 * Pure read — never mutates storage. Returns `null` for any case the
 * caller should treat as "no persisted choice" (missing key, corrupt
 * value, unsupported language, storage exception).
 */

const SUPPORTED = new Set(["en", "fr"])

export type PersistedLocale = "en" | "fr"

/**
 * Maps a BCP-47 language tag onto a supported locale, or `null`.
 *
 * Needed wherever a tag meets a narrower type: `i18n.language` carries a region
 * ("en-US") when it comes from the browser detector, and `user_profiles.locale`
 * has a CHECK constraint that only accepts the base subtag.
 */
export function normalizeLocale(
  language: string | null | undefined,
): PersistedLocale | null {
  const base = language?.toLowerCase().split("-")[0]
  return base && SUPPORTED.has(base) ? (base as PersistedLocale) : null
}

/**
 * The **Display Locale** to use before any stored or profile preference is
 * known: the browser's language when supported, English otherwise — the same
 * order i18next's detector applies, so the two can't disagree.
 */
export function detectLocale(
  language: string | null | undefined,
): PersistedLocale {
  return normalizeLocale(language) ?? "en"
}

export function readPersistedLocale(storage: Storage): PersistedLocale | null {
  let raw: string | null
  try {
    raw = storage.getItem("locale")
  } catch {
    return null
  }
  if (!raw) return null

  // Two possible encodings:
  //   1. jotai → '"fr"' (JSON-stringified)
  //   2. raw → 'fr' (set directly via DevTools or older versions)
  // Try JSON.parse first; if it succeeds and gives a string, use it.
  // Otherwise fall back to the raw value as-is.
  let candidate: string = raw
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === "string") candidate = parsed
  } catch {
    // raw stays as-is
  }

  return SUPPORTED.has(candidate) ? (candidate as PersistedLocale) : null
}
