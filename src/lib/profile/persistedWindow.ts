import {
  isProfileWindowKind,
  type ProfileWindowKind,
} from "@/lib/profile/window"

export const PROFILE_WINDOW_STORAGE_KEY = "profileWindow"

export const DEFAULT_PROFILE_WINDOW: ProfileWindowKind = "30"

export function readPersistedProfileWindow(
  storage: Storage,
): ProfileWindowKind | null {
  let raw: string | null
  try {
    raw = storage.getItem(PROFILE_WINDOW_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw == null || raw === "") return null
  return isProfileWindowKind(raw) ? raw : null
}

export function writePersistedProfileWindow(
  storage: Storage,
  kind: ProfileWindowKind,
): void {
  try {
    storage.setItem(PROFILE_WINDOW_STORAGE_KEY, kind)
  } catch {
    // Private mode / quota: the view still works for this visit.
  }
}

export function resolveProfileWindow(storage: Storage): ProfileWindowKind {
  const stored = readPersistedProfileWindow(storage)
  if (stored === "all") {
    writePersistedProfileWindow(storage, DEFAULT_PROFILE_WINDOW)
    return DEFAULT_PROFILE_WINDOW
  }
  return stored ?? DEFAULT_PROFILE_WINDOW
}
