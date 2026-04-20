import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue, useSetAtom } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom, isAdminAtom, isAdminLoadingAtom } from "@/store/atoms"

/**
 * Checks whether the current user's email is in `admin_users`.
 *
 * React Query dedupes across the tree, replaces the old imperative
 * `checkAdminStatus` call in `lib/supabase.ts` (single source of truth),
 * and uses `.maybeSingle()` so a missing row returns `null` without the
 * PGRST116 / 406 noise. Result is mirrored into `isAdminAtom` /
 * `isAdminLoadingAtom` so existing readers (`AdminGuard`, `AdminOnly`) keep
 * working unchanged.
 */
export function useIsAdmin() {
  const user = useAtomValue(authAtom)
  const setIsAdmin = useSetAtom(isAdminAtom)
  const setIsAdminLoading = useSetAtom(isAdminLoadingAtom)

  const email = user?.email

  const { data, isLoading, isFetched } = useQuery({
    queryKey: ["is-admin", email],
    queryFn: async () => {
      if (!email) return false
      const { data, error } = await supabase
        .from("admin_users")
        .select("email")
        .eq("email", email)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const isAdmin = data ?? false

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      setIsAdminLoading(false)
      return
    }
    setIsAdmin(isAdmin)
    setIsAdminLoading(isLoading && !isFetched)
  }, [user, isAdmin, isLoading, isFetched, setIsAdmin, setIsAdminLoading])

  return { isAdmin, isLoading }
}
