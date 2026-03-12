import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type { User } from "@/types/auth"

export interface SessionState {
  currentDayId: string | null
  exerciseIndex: number
  setsData: Record<string, Array<{ reps: string; weight: string; done: boolean }>>
  startedAt: number | null
  isActive: boolean
  totalSetsDone: number
}

const defaultSessionState: SessionState = {
  currentDayId: null,
  exerciseIndex: 0,
  setsData: {},
  startedAt: null,
  isActive: false,
  totalSetsDone: 0,
}

export const authAtom = atom<User | null>(null)
export const authLoadingAtom = atom(true)

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

export const drawerOpenAtom = atom(false)
