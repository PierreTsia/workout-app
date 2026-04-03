import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchExercisesByIds } from "@/lib/fetchExercisesByIds"
import { queryClient } from "@/lib/queryClient"
import type { Exercise } from "@/types/database"

/** Prefix for query invalidation alongside per-id `["exercise", id]` keys. */
export const EXERCISES_BATCH_QUERY_KEY = "exercises-batch" as const

function sortedUniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export function exerciseBatchQueryKey(ids: readonly string[]) {
  const sorted = sortedUniqueIds(ids)
  return [EXERCISES_BATCH_QUERY_KEY, sorted.join(",")] as const
}

/**
 * Single batched `exercises` fetch for many ids; hydrates `["exercise", id]` so
 * `useExerciseById` stays warm without extra HTTP when batch ran first.
 */
export function useExerciseBatch(exerciseIds: readonly string[]) {
  const sortedIds = useMemo(() => sortedUniqueIds(exerciseIds), [exerciseIds])

  return useQuery({
    queryKey: exerciseBatchQueryKey(exerciseIds),
    queryFn: async (): Promise<Exercise[]> => {
      const rows = await fetchExercisesByIds(sortedIds)
      rows.forEach((ex) => {
        queryClient.setQueryData<Exercise>(["exercise", ex.id], ex)
      })
      return rows
    },
    enabled: sortedIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}
