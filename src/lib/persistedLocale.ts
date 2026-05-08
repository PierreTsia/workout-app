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
