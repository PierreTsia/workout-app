import { useCallback, useEffect } from "react"
import { useAtomValue, useSetAtom } from "jotai"

import { supabase } from "@/lib/supabase"
import {
  readPersistedLocale,
  type PersistedLocale,
} from "@/lib/persistedLocale"
import { authAtom, localeAtom } from "@/store/atoms"
import { useUserProfile } from "@/hooks/useUserProfile"

/**
 * The cross-device half of the **Display Locale** (T152).
 *
 * `localStorage` stays authoritative at render: the profile is only readable
 * once auth has resolved, so consulting it first would flash untranslated
 * content on every load. The column exists to seed a device that has stored
 * nothing — and to make server-side senders (emails, MCP) possible later.
 */
export function usePersistProfileLocale() {
  const user = useAtomValue(authAtom)

  return useCallback(
    async (locale: PersistedLocale) => {
      if (!user) return

      // Deliberately silent. `localStorage` has already won, so the UI is
      // correct and only cross-device sync is lost — no toast, no retry. A
      // language preference is not training data.
      try {
        await supabase
          .from("user_profiles")
          .update({ locale })
          .eq("user_id", user.id)
      } catch {
        // Same reasoning: a rejected request changes nothing the reader can see.
      }
    },
    [user],
  )
}

/**
 * Adopts the profile's language on a device that has never stored one — the
 * second install, where the browser would otherwise decide.
 *
 * Writing it to storage is the point rather than a side effect: the next boot
 * then resolves synchronously and skips the one-time flash entirely.
 */
export function useHydrateLocaleFromProfile() {
  const { data: profile } = useUserProfile()
  const setLocale = useSetAtom(localeAtom)
  const profileLocale = profile?.locale ?? null

  useEffect(() => {
    if (!profileLocale) return
    // An explicit choice made on this device outranks the profile, always.
    if (readPersistedLocale(window.localStorage)) return

    setLocale(profileLocale)
  }, [profileLocale, setLocale])
}
