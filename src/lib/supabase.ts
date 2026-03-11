import { createClient } from "@supabase/supabase-js"
import { getDefaultStore } from "jotai"
import { authAtom, authLoadingAtom } from "@/store/atoms"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const store = getDefaultStore()

supabase.auth.getSession().then(({ data: { session } }) => {
  store.set(authAtom, session?.user ?? null)
  store.set(authLoadingAtom, false)
})

supabase.auth.onAuthStateChange((_event, session) => {
  store.set(authAtom, session?.user ?? null)
})
