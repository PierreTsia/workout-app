import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type { User } from "@/types/auth"

export interface SessionState {
  currentDayId: string | null
  activeDayId: string | null
  exerciseIndex: number
  setsData: Record<string, Array<{ reps: string; weight: string; done: boolean; rir?: number }>>
  startedAt: number | null
  isActive: boolean
  totalSetsDone: number
  pausedAt: number | null
  accumulatedPause: number
  cycleId: string | null
}

const defaultSessionState: SessionState = {
  currentDayId: null,
  activeDayId: null,
  exerciseIndex: 0,
  setsData: {},
  startedAt: null,
  isActive: false,
  totalSetsDone: 0,
  pausedAt: null,
  accumulatedPause: 0,
  cycleId: null,
}

export const authAtom = atom<User | null>(null)
export const authLoadingAtom = atom(true)

export const isAdminAtom = atom(false)
export const isAdminLoadingAtom = atom(true)

export const hasProgramAtom = atom(false)
export const hasProgramLoadingAtom = atom(true)
export const activeProgramIdAtom = atom<string | null>(null)

/** `getOnInit`: read localStorage on first `get` so the value is correct before any `onMount` (needed for WorkoutPage patch hydration and any first-paint session reads). */
export const sessionAtom = atomWithStorage<SessionState>(
  "session",
  defaultSessionState,
  undefined,
  { getOnInit: true },
)

export const completedExerciseIdsAtom = atom((get) => {
  const session = get(sessionAtom)
  const completed = new Set<string>()
  for (const [exerciseId, sets] of Object.entries(session.setsData)) {
    if (sets.length > 0 && sets.every((s) => s.done)) {
      completed.add(exerciseId)
    }
  }
  return completed
})

export interface RestState {
  startedAt: number
  durationSeconds: number
  pausedAt: number | null
  accumulatedPause: number
  /** True when `pausedAt` was set because the workout session was paused (not the rest drawer). */
  pausedForWorkoutSession?: boolean
}

export const restAtom = atomWithStorage<RestState | null>("rest", null)

export const syncStatusAtom = atom<"idle" | "syncing" | "failed" | "synced">(
  "idle",
)

export const queueSyncMetaAtom = atomWithStorage<{
  lastSyncAt?: number
  pendingCount: number
}>("queueSyncMeta", { pendingCount: 0 })

export const prFlagsAtom = atom<Record<string, boolean>>({})

export const sessionBest1RMAtom = atom<Record<string, number>>({})

export const installPromptStateAtom = atomWithStorage<{ dismissed: boolean }>(
  "installPrompt",
  { dismissed: false },
)

export const localeAtom = atomWithStorage<"en" | "fr">("locale", "fr")

export const weightUnitAtom = atomWithStorage<"kg" | "lbs">("weightUnit", "kg")

export const drawerOpenAtom = atom(false)

export const isQuickWorkoutAtom = atomWithStorage<boolean>(
  "isQuickWorkout",
  false,
)

export const quickSheetOpenAtom = atom(false)
