import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { detectLocale, type PersistedLocale } from "@/lib/persistedLocale"
import type { User } from "@/types/auth"
import type { SessionSetRow } from "@/lib/sessionSetRow"
import type { UnlockedAchievement } from "@/types/achievements"

export interface SessionState {
  currentDayId: string | null
  activeDayId: string | null
  exerciseIndex: number
  setsData: Record<string, SessionSetRow[]>
  startedAt: number | null
  isActive: boolean
  totalSetsDone: number
  pausedAt: number | null
  accumulatedPause: number
  cycleId: string | null
  /** Ids of Exercise Blocks fully completed this session (#351). Optional for back-compat. */
  completedBlockIds?: string[]
}

export const defaultSessionState: SessionState = {
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
  completedBlockIds: [],
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

/** Block ids fully completed this session — mirrors {@link completedExerciseIdsAtom} for circuits (#351). */
export const completedBlockIdsAtom = atom(
  (get) => new Set(get(sessionAtom).completedBlockIds ?? []),
)

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

/**
 * Persisted so a mid-session refresh doesn't wipe PR detection state. Without
 * persistence, `WorkoutPage` would compute `prExercises` from an empty map
 * after a reload and the bilan would show no PRs even though `set_logs.was_pr`
 * is correct in the DB (regression #291). `getOnInit` mirrors `sessionAtom` so
 * the value is correct on first paint of `SessionSummary`.
 */
export const prFlagsAtom = atomWithStorage<Record<string, boolean>>(
  "prFlags",
  {},
  undefined,
  { getOnInit: true },
)

/**
 * Best PR-relevant score per `exercise_id` this session (1RM, reps, or seconds
 * — matches `PrModality`). Persisted alongside `prFlagsAtom` so post-refresh
 * sets are still compared against the in-session running best, not just the
 * historical best from the DB.
 */
export const sessionBestPerformanceAtom = atomWithStorage<Record<string, number>>(
  "sessionBestPerformance",
  {},
  undefined,
  { getOnInit: true },
)

export const installPromptStateAtom = atomWithStorage<{ dismissed: boolean }>(
  "installPrompt",
  { dismissed: false },
)

/**
 * **Display Locale**, in precedence order: this stored value (an explicit
 * choice, and the only one that survives a reload synchronously), then
 * `user_profiles.locale` (which seeds a device that has never stored one), then
 * the browser, then English.
 *
 * The default is *detected* rather than hardcoded on purpose. It used to be
 * "fr" while `fallbackLng` was "en", and since `SideDrawer` pushes this atom
 * onto i18n, a fresh device with an English browser switched itself to French
 * as soon as the shell mounted.
 */
export const localeAtom = atomWithStorage<PersistedLocale>(
  "locale",
  detectLocale(typeof navigator === "undefined" ? null : navigator.language),
  undefined,
  // `getOnInit`, like `sessionAtom`: this value decides the language of the
  // first paint, so it has to be the stored choice from the very first read
  // rather than a default that a later mount corrects.
  { getOnInit: true },
)

export const weightUnitAtom = atomWithStorage<"kg" | "lbs">("weightUnit", "kg")

export const drawerOpenAtom = atom(false)

export const isQuickWorkoutAtom = atomWithStorage<boolean>(
  "isQuickWorkout",
  false,
)

export const quickSheetOpenAtom = atom(false)

/** Overlay queue — consumed on display, shift on dismiss. */
export const achievementUnlockQueueAtom = atom<UnlockedAchievement[]>([])

/** Tier IDs already shown this session — prevents Realtime + RPC overlap duplicates. In-memory only (reset on reload). */
export const achievementShownIdsAtom = atom<Set<string>>(new Set<string>())

/** Populated by processSessionFinish, read by SessionBadges, cleared on next session start. */
export const lastSessionBadgesAtom = atom<UnlockedAchievement[]>([])
