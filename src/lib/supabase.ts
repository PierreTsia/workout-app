import { createClient } from "@supabase/supabase-js"
import { getDefaultStore } from "jotai"
import {
  authAtom,
  authLoadingAtom,
  isAdminAtom,
  isAdminLoadingAtom,
} from "@/store/atoms"
import { drainQueue } from "@/lib/syncService"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const store = getDefaultStore()

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
  } else {
    store.set(isAdminLoadingAtom, false)
  }
})

supabase.auth.onAuthStateChange((event, session) => {
  store.set(authAtom, session?.user ?? null)
  if (event === "SIGNED_IN" && session?.user) {
    drainQueue(session.user.id)
    checkAdminStatus(session.user.email)
  }
  if (event === "SIGNED_OUT") {
    store.set(isAdminAtom, false)
    store.set(isAdminLoadingAtom, false)
  }
})
