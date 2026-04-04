declare const __APP_VERSION__: string

const VERSION_KEY = "app_version"

/** Keys that are always safe to keep across upgrades. */
const ALWAYS_KEEP = new Set([
  "locale",
  "weightUnit",
  "workout-app-theme",
  "theme",
  "installPrompt",
  "notification_permission_granted",
])

/** Keys to preserve only when a workout session is in progress. */
const SESSION_KEEP = new Set([
  "session",
  "rest",
  "session-exercise-patch",
  "queueSyncMeta",
  "isQuickWorkout",
])

function shouldKeep(key: string, preserveSessionBundle: boolean): boolean {
  if (key === VERSION_KEY) return true
  if (ALWAYS_KEEP.has(key)) return true
  if (key.startsWith("sb-") && key.endsWith("-auth-token")) return true
  // Unsynced offline data must never be lost.
  if (key.startsWith("offlineQueue:") || key.startsWith("sessionMeta:")) return true
  if (preserveSessionBundle && SESSION_KEEP.has(key)) return true
  return false
}

/**
 * True when dropping `SESSION_KEEP` keys would risk losing recoverable workout UI state.
 * Not only `isActive`: after finish we set `isActive: false` while `setsData` still holds
 * the last session until the user starts a new one; an upgrade in between must not wipe.
 */
function shouldPreserveSessionBundleKeys(): boolean {
  try {
    const raw = localStorage.getItem("session")
    if (!raw) return false
    const parsed = JSON.parse(raw) as {
      isActive?: boolean
      totalSetsDone?: number
      setsData?: Record<string, unknown>
    }
    if (parsed.isActive === true) return true
    if (typeof parsed.totalSetsDone === "number" && parsed.totalSetsDone > 0) {
      return true
    }
    const sd = parsed.setsData
    if (sd && typeof sd === "object") {
      return Object.values(sd).some(
        (rows) => Array.isArray(rows) && rows.length > 0,
      )
    }
    return false
  } catch {
    return false
  }
}

async function purgeWorkboxCaches() {
  try {
    if (!("caches" in window)) return
    const names = await caches.keys()
    await Promise.all(
      names.map((name) => {
        if (name === "supabase-api" || name.startsWith("workbox-precache")) {
          return caches.delete(name)
        }
        return Promise.resolve()
      }),
    )
  } catch {
    // Cache API may be unavailable (e.g. opaque origin, SecurityError).
  }
}

function purgeStaleLocalStorage(preserveSessionBundle: boolean) {
  try {
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (!shouldKeep(key, preserveSessionBundle)) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // localStorage may throw SecurityError or QuotaExceededError.
  }
}

/**
 * Compares the build-time version with what's stored in localStorage.
 * On mismatch: purges Workbox caches + stale localStorage keys.
 *
 * Must run BEFORE React mounts so Jotai atomWithStorage reads see clean values.
 * Does NOT reload — the SW controllerchange listener handles that when
 * the service worker itself is swapped. This avoids a double-reload.
 *
 * Designed to never throw — all storage/cache operations are guarded.
 */
export async function handleVersionUpgrade(): Promise<void> {
  try {
    const stored = localStorage.getItem(VERSION_KEY)
    const current = __APP_VERSION__

    if (stored === current) return

    if (stored !== null) {
      const preserveSessionBundle = shouldPreserveSessionBundleKeys()
      await purgeWorkboxCaches()
      purgeStaleLocalStorage(preserveSessionBundle)
    }

    localStorage.setItem(VERSION_KEY, current)
  } catch {
    // Best-effort: if storage is completely inaccessible, skip upgrade silently.
  }
}
