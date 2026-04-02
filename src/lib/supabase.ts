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
  sessionBest1RMAtom,
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

async function checkProgramStatus(userId: string) {
  try {
    const { data } = await supabase
      .from("programs")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single()
    store.set(hasProgramAtom, !!data)
    store.set(activeProgramIdAtom, data?.id ?? null)
  } catch {
    store.set(hasProgramAtom, false)
    store.set(activeProgramIdAtom, null)
  }
  store.set(hasProgramLoadingAtom, false)
}

async function checkAdminStatus(email: string | undefined) {
  if (!email) {
    store.set(isAdminAtom, false)
    store.set(isAdminLoadingAtom, false)
    return
  }
  try {
    const { data } = await supabase
      .from("admin_users")
      .select("email")
      .eq("email", email)
      .single()
    store.set(isAdminAtom, !!data)
  } catch {
    store.set(isAdminAtom, false)
  }
  store.set(isAdminLoadingAtom, false)
}

supabase.auth.getSession().then(({ data: { session } }) => {
  store.set(authAtom, session?.user ?? null)
  store.set(authLoadingAtom, false)
  if (session?.user) {
    drainQueue(session.user.id)
    checkAdminStatus(session.user.email)
    checkProgramStatus(session.user.id)
  } else {
    store.set(isAdminLoadingAtom, false)
    store.set(hasProgramLoadingAtom, false)
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
  store.set(sessionBest1RMAtom, {})
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
    checkAdminStatus(session.user.email)
    checkProgramStatus(session.user.id)
  }
  if (event === "SIGNED_OUT") {
    clearUserState()
  }
})
