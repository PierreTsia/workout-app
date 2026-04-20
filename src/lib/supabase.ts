import { createClient } from "@supabase/supabase-js"
import { getDefaultStore } from "jotai"
import {
  authAtom,
  authLoadingAtom,
  isAdminAtom,
  isAdminLoadingAtom,
  hasProgramAtom,
  hasProgramLoadingAtom,
  activeProgramIdAtom,
  sessionAtom,
  defaultSessionState,
  restAtom,
  syncStatusAtom,
  queueSyncMetaAtom,
  prFlagsAtom,
  sessionBestPerformanceAtom,
  isQuickWorkoutAtom,
  drawerOpenAtom,
  quickSheetOpenAtom,
  achievementUnlockQueueAtom,
  achievementShownIdsAtom,
  lastSessionBadgesAtom,
} from "@/store/atoms"
import { drainQueue } from "@/lib/syncService"
import { clearSessionExercisePatchStorage } from "@/lib/sessionExercisePatchStorage"
import { queryClient } from "@/lib/queryClient"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const store = getDefaultStore()

// Admin + active-program status are now owned by React Query hooks
// (`useIsAdmin`, `useActiveProgram`) mounted by `AuthDataBridge`. Those hooks
// sync their results to the existing atoms so guards + other readers keep
// working, without the double-fetch (getSession + SIGNED_IN) and 406 noise
// the previous imperative `.single()` calls produced.
supabase.auth.getSession().then(({ data: { session } }) => {
  store.set(authAtom, session?.user ?? null)
  store.set(authLoadingAtom, false)
  if (session?.user) {
    drainQueue(session.user.id)
  }
})

export function clearUserState() {
  store.set(isAdminAtom, false)
  store.set(isAdminLoadingAtom, false)
  store.set(hasProgramAtom, false)
  store.set(hasProgramLoadingAtom, false)
  store.set(activeProgramIdAtom, null)

  store.set(sessionAtom, defaultSessionState)
  store.set(restAtom, null)
  store.set(syncStatusAtom, "idle")
  store.set(queueSyncMetaAtom, { pendingCount: 0 })
  store.set(prFlagsAtom, {})
  store.set(sessionBestPerformanceAtom, {})
  store.set(isQuickWorkoutAtom, false)
  store.set(drawerOpenAtom, false)
  store.set(quickSheetOpenAtom, false)
  store.set(achievementUnlockQueueAtom, [])
  store.set(achievementShownIdsAtom, new Set())
  store.set(lastSessionBadgesAtom, [])

  clearSessionExercisePatchStorage()
  queryClient.clear()
}

supabase.auth.onAuthStateChange((event, session) => {
  store.set(authAtom, session?.user ?? null)
  if (event === "SIGNED_IN" && session?.user) {
    drainQueue(session.user.id)
  }
  if (event === "SIGNED_OUT") {
    clearUserState()
  }
})
