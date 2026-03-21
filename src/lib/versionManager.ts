declare const __APP_VERSION__: string

const VERSION_KEY = "app_version"

/** Keys that are always safe to keep across upgrades. */
const ALWAYS_KEEP = new Set([
  "locale",
  "weightUnit",
  "workout-app-theme",
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

function shouldKeep(key: string, hasActiveSession: boolean): boolean {
  if (key === VERSION_KEY) return true
  if (ALWAYS_KEEP.has(key)) return true
  if (key.startsWith("sb-") && key.endsWith("-auth-token")) return true
  // Unsynced offline data must never be lost.
  if (key.startsWith("offlineQueue:") || key.startsWith("sessionMeta:")) return true
  if (hasActiveSession && SESSION_KEEP.has(key)) return true
  return false
}

function hasActiveSession(): boolean {
  try {
    const raw = localStorage.getItem("session")
    if (!raw) return false
    const parsed = JSON.parse(raw) as { isActive?: boolean }
    return parsed.isActive === true
  } catch {
    return false
  }
}

async function purgeWorkboxCaches() {
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
}

function purgeStaleLocalStorage(preserveSession: boolean) {
  const keys = Object.keys(localStorage)
  for (const key of keys) {
    if (!shouldKeep(key, preserveSession)) {
      localStorage.removeItem(key)
    }
  }
}

/**
 * Compares the build-time version with what's stored in localStorage.
 * On mismatch: purges Workbox caches + stale localStorage keys.
 *
 * Must run BEFORE React mounts so Jotai atomWithStorage reads see clean values.
 * Does NOT reload — the SW controllerchange listener handles that when
 * the service worker itself is swapped. This avoids a double-reload.
 */
export async function handleVersionUpgrade(): Promise<void> {
  const stored = localStorage.getItem(VERSION_KEY)
  const current = __APP_VERSION__

  if (stored === current) return

  if (stored !== null) {
    const activeSession = hasActiveSession()
    await purgeWorkboxCaches()
    purgeStaleLocalStorage(activeSession)
  }

  localStorage.setItem(VERSION_KEY, current)
}
