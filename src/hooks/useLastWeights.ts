import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import {
  fetchLastWeightsForExerciseIds,
  fetchLastWeightsForSlots,
  type SlotWeightRef,
} from "@/lib/lastWeightsFromSetLogs"
import { authAtom } from "@/store/atoms"

/**
 * Single source of truth for the catalog-global "last weights" cache contract
 * (add/swap seed). Sorting the ids in the queryKey guarantees that `[a, b]`
 * and `[b, a]` hit the same cache entry.
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

function slotCacheKey(slots: SlotWeightRef[]): string {
  return slots
    .map((s) => `${s.workoutExerciseId}:${s.exerciseId}`)
    .sort()
    .join(",")
}

/** Existing-slot session prefill — keyed by workout_exercise_id (#463 / T175). */
export function lastWeightsForSlotsQueryConfig(slots: SlotWeightRef[]) {
  const key = slotCacheKey(slots)
  return {
    queryKey: ["last-weights-slots", key] as const,
    queryFn: () => fetchLastWeightsForSlots(slots),
  }
}

export function useLastWeightsForSlots(slots: SlotWeightRef[]) {
  const user = useAtomValue(authAtom)
  const config = lastWeightsForSlotsQueryConfig(slots)

  return useQuery<Record<string, number>>({
    ...config,
    enabled: slots.length > 0 && !!user,
  })
}
