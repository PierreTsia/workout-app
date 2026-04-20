import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue, useSetAtom } from "jotai"
import { supabase } from "@/lib/supabase"
import {
  authAtom,
  hasProgramAtom,
  hasProgramLoadingAtom,
  activeProgramIdAtom,
} from "@/store/atoms"
import type { Program } from "@/types/onboarding"

/**
 * Fetches the current user's active program.
 *
 * `.maybeSingle()` avoids the PGRST116 / 406 response PostgREST emits when
 * `.single()` sees zero rows. Result mirrors into `hasProgramAtom` /
 * `hasProgramLoadingAtom` / `activeProgramIdAtom` so existing readers
 * (`OnboardingGuard`, `WorkoutPage`, `syncService`) keep working unchanged.
 * Mutation hooks (`useCreateProgram`, `useActivateProgram`,
 * `useGenerateProgram`) still write those atoms imperatively for instant UI
 * feedback; this effect is a non-destructive downstream sync.
 */
export function useActiveProgram() {
  const user = useAtomValue(authAtom)
  const setHasProgram = useSetAtom(hasProgramAtom)
  const setHasProgramLoading = useSetAtom(hasProgramLoadingAtom)
  const setActiveProgramId = useSetAtom(activeProgramIdAtom)

  const query = useQuery<Program | null>({
    queryKey: ["active-program", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, user_id, name, template_id, is_active, archived_at, created_at")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle()

      if (error) throw error
      return (data as Program) ?? null
    },
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const { data, isLoading, isFetched } = query

  useEffect(() => {
    if (!user) {
      setHasProgram(false)
      setActiveProgramId(null)
      setHasProgramLoading(false)
      return
    }
    setHasProgram(!!data)
    setActiveProgramId(data?.id ?? null)
    setHasProgramLoading(isLoading && !isFetched)
  }, [
    user,
    data,
    isLoading,
    isFetched,
    setHasProgram,
    setActiveProgramId,
    setHasProgramLoading,
  ])

  return query
}
