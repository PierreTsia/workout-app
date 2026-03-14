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
}

export const authAtom = atom<User | null>(null)
export const authLoadingAtom = atom(true)

export const isAdminAtom = atom(false)
export const isAdminLoadingAtom = atom(true)

export const hasProgramAtom = atom(false)
export const hasProgramLoadingAtom = atom(true)
export const activeProgramIdAtom = atom<string | null>(null)

export const sessionAtom = atomWithStorage<SessionState>(
  "session",
  defaultSessionState,
)

export const restAtom = atomWithStorage<{
  startedAt: number
  durationSeconds: number
} | null>("rest", null)

export const themeAtom = atomWithStorage<"dark" | "light">("theme", "dark")

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
