import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { fetchLastWeightsForExerciseIds } from "@/lib/lastWeightsFromSetLogs"
import { authAtom } from "@/store/atoms"

export function useLastWeights(exerciseIds: string[]) {
  const user = useAtomValue(authAtom)
  const sortedIds = [...exerciseIds].sort()

  return useQuery<Record<string, number>>({
    queryKey: ["last-weights", sortedIds],
    queryFn: () => fetchLastWeightsForExerciseIds(sortedIds),
    enabled: sortedIds.length > 0 && !!user,
  })
}
