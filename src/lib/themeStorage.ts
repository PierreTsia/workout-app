/**
 * next-themes default is `theme`, which collides with other scripts/extensions.
 * We use a namespaced key and migrate from the legacy key once.
 */
export const THEME_STORAGE_KEY = "workout-app-theme"

/** Previous key (Jotai + old next-themes); migrated on boot */
export const LEGACY_THEME_STORAGE_KEY = "theme"

/**
 * When there is no saved preference or it is `system`, we follow the OS.
 * If `prefers-color-scheme` cannot be read, we use this resolved default (not light).
 */
export const THEME_FALLBACK_RESOLVED = "dark" as const

const VALID_PLAIN = new Set(["dark", "light", "system"])

export type StoredThemePreference = "light" | "dark" | "system"

/**
 * Read-only parse of a single localStorage entry.
 * Preference order for the app overall:
 * 1. Persisted `light` | `dark` | `system` under {@link THEME_STORAGE_KEY} (then legacy key, migrated at boot)
 * 2. If missing or `system`, `prefers-color-scheme` (see {@link resolveThemeClassForBoot})
 * 3. If the media query is unavailable, {@link THEME_FALLBACK_RESOLVED}
 */
export function parseStoredThemePreference(
  raw: string | null,
): StoredThemePreference | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (trimmed === "") return null
  if (VALID_PLAIN.has(trimmed)) return trimmed as StoredThemePreference
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed === "dark" || parsed === "light" || parsed === "system") {
      return parsed as StoredThemePreference
    }
  } catch {
    /* not JSON */
  }
  return null
}

/** `light` | `dark` to put on `document.documentElement` before React (matches next-themes `class` strategy). */
export function resolveThemeClassForBoot(storage: Storage): "light" | "dark" {
  const raw =
    storage.getItem(THEME_STORAGE_KEY) ?? storage.getItem(LEGACY_THEME_STORAGE_KEY)
  const pref = parseStoredThemePreference(raw)
  if (pref === "light" || pref === "dark") return pref
  return resolveSystemOrFallbackDark()
}

function resolveSystemOrFallbackDark(): "light" | "dark" {
  try {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    }
  } catch {
    /* ignore */
  }
  return THEME_FALLBACK_RESOLVED
}

/**
 * Jotai `atomWithStorage` used JSON encoding on the same key as next-themes,
 * which expects plain `dark` | `light` | `system`. Normalize or drop invalid values.
 */
export function normalizeLegacyThemeLocalStorage(
  storage: Storage,
  key: string = THEME_STORAGE_KEY,
): void {
  const raw = storage.getItem(key)
  if (raw === null) return
  const trimmed = raw.trim()
  if (trimmed === "") {
    storage.removeItem(key)
    return
  }
  if (trimmed !== raw) {
    storage.setItem(key, trimmed)
  }
  const v = storage.getItem(key)!
  if (VALID_PLAIN.has(v)) return
  try {
    const parsed = JSON.parse(v) as unknown
    if (parsed === "dark" || parsed === "light") {
      storage.setItem(key, parsed)
      return
    }
  } catch {
    /* not JSON */
  }
  storage.removeItem(key)
}

/**
 * Fix JSON-shaped values on the legacy key, copy a valid preference to the
 * canonical key, then normalize the canonical key. Call once before React mounts.
 */
export function prepareThemeLocalStorage(storage: Storage): void {
  normalizeLegacyThemeLocalStorage(storage, LEGACY_THEME_STORAGE_KEY)

  const existing = storage.getItem(THEME_STORAGE_KEY)
  if (!existing) {
    const legacy = storage.getItem(LEGACY_THEME_STORAGE_KEY)
    if (legacy && VALID_PLAIN.has(legacy)) {
      storage.setItem(THEME_STORAGE_KEY, legacy)
      storage.removeItem(LEGACY_THEME_STORAGE_KEY)
    } else if (legacy) {
      try {
        const parsed = JSON.parse(legacy) as unknown
        if (parsed === "dark" || parsed === "light") {
          storage.setItem(THEME_STORAGE_KEY, parsed)
          storage.removeItem(LEGACY_THEME_STORAGE_KEY)
        }
      } catch {
        /* ignore */
      }
    }
  }

  normalizeLegacyThemeLocalStorage(storage, THEME_STORAGE_KEY)

  const final = storage.getItem(THEME_STORAGE_KEY)
  if (final && VALID_PLAIN.has(final)) {
    storage.removeItem(LEGACY_THEME_STORAGE_KEY)
  }
}
