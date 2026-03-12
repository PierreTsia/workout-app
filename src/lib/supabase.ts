import { createClient } from "@supabase/supabase-js"
import { getDefaultStore } from "jotai"
import { authAtom, authLoadingAtom } from "@/store/atoms"
import { drainQueue } from "@/lib/syncService"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const store = getDefaultStore()

supabase.auth.getSession().then(({ data: { session } }) => {
  store.set(authAtom, session?.user ?? null)
  store.set(authLoadingAtom, false)
  if (session?.user) drainQueue(session.user.id)
})

supabase.auth.onAuthStateChange((event, session) => {
  store.set(authAtom, session?.user ?? null)
  if (event === "SIGNED_IN" && session?.user) {
    drainQueue(session.user.id)
  }
})
