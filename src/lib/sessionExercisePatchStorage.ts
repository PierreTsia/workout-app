import type {
  PreSessionExercisePatch,
  SerializedPreSessionExercisePatch,
} from "@/types/preSessionOverrides"
import {
  deserializePreSessionPatch,
  emptyPreSessionPatch,
  serializePreSessionPatch,
} from "@/types/preSessionOverrides"

const PATCH_KEY = "session-exercise-patch"

export interface SessionExercisePatchEnvelope {
  activeDayId: string
  startedAt: number
  patch: SerializedPreSessionExercisePatch
}

function safeParse(raw: string | null): SessionExercisePatchEnvelope | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as SessionExercisePatchEnvelope
    if (
      !v ||
      typeof v.activeDayId !== "string" ||
      typeof v.startedAt !== "number" ||
      !v.patch ||
      !Array.isArray(v.patch.deletedIds) ||
      !Array.isArray(v.patch.swappedRows) ||
      !Array.isArray(v.patch.addedRows)
    ) {
      return null
    }
    return v
  } catch {
    return null
  }
}

export function loadSessionExercisePatch(
  activeDayId: string,
  startedAt: number,
): PreSessionExercisePatch | null {
  if (typeof window === "undefined") return null
  try {
    const env = safeParse(localStorage.getItem(PATCH_KEY))
    if (!env) return null
    if (env.activeDayId !== activeDayId || env.startedAt !== startedAt) {
      return null
    }
    return deserializePreSessionPatch(env.patch)
  } catch {
    return null
  }
}

export function saveSessionExercisePatch(
  activeDayId: string,
  startedAt: number,
  patch: PreSessionExercisePatch,
): void {
  if (typeof window === "undefined") return
  try {
    const envelope: SessionExercisePatchEnvelope = {
      activeDayId,
      startedAt,
      patch: serializePreSessionPatch(patch),
    }
    localStorage.setItem(PATCH_KEY, JSON.stringify(envelope))
  } catch {
    /* quota / private mode */
  }
}

export function clearSessionExercisePatchStorage(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(PATCH_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Hydrate patch when restoring an active session after reload.
 * Uses the same day key as `activeSessionDayId` in WorkoutPage (`activeDayId ?? currentDayId`).
 */
export function getInitialPreSessionPatchForHydration(
  isActive: boolean,
  workoutDayId: string | null,
  startedAt: number | null,
): PreSessionExercisePatch {
  if (
    !isActive ||
    workoutDayId == null ||
    startedAt == null ||
    typeof window === "undefined"
  ) {
    return emptyPreSessionPatch()
  }
  return loadSessionExercisePatch(workoutDayId, startedAt) ?? emptyPreSessionPatch()
}
