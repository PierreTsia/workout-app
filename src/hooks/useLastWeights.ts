import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { fetchLastWeightsForExerciseIds } from "@/lib/lastWeightsFromSetLogs"
import { authAtom } from "@/store/atoms"

/**
 * Single source of truth for the "last weights" cache contract.
 *
 * Used by:
 * - `useLastWeights(ids)` — reactive subscription to the cached value
 * - `queryClient.fetchQuery(lastWeightsQueryConfig(ids))` — imperative
 *   fetch from anywhere a hook can't run (e.g. async callbacks).
 *
 * Sorting the ids in the queryKey guarantees that `[a, b]` and `[b, a]`
 * hit the same cache entry, so the two access patterns above always
 * stay in sync.
 */
export function lastWeightsQueryConfig(exerciseIds: string[]) {
  const sortedIds = [...exerciseIds].sort()
  return {
    queryKey: ["last-weights", sortedIds] as const,
    queryFn: () => fetchLastWeightsForExerciseIds(sortedIds),
  }
}

export function useLastWeights(exerciseIds: string[]) {
  const user = useAtomValue(authAtom)
  const config = lastWeightsQueryConfig(exerciseIds)

  return useQuery<Record<string, number>>({
    ...config,
    enabled: config.queryKey[1].length > 0 && !!user,
  })
}
