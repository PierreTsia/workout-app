import { useInfiniteQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"

const PAGE_SIZE = 20

export interface UseExerciseLibraryPaginatedParams {
  search: string
  muscleGroup: string | null
  equipment: string[]
  difficulty: string[]
  enabled?: boolean
}

export function useExerciseLibraryPaginated({
  search,
  muscleGroup,
  equipment,
  difficulty,
  enabled = true,
}: UseExerciseLibraryPaginatedParams) {
  const equipmentKey = [...equipment].sort()
  const difficultyKey = [...difficulty].sort()
  const query = useInfiniteQuery({
    queryKey: ["exercise-library-paginated", search.trim(), muscleGroup, equipmentKey, difficultyKey],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("search_exercises", {
        search_term: search.trim(),
        filter_muscle_group: muscleGroup ?? undefined,
        filter_equipment: equipmentKey.length > 0 ? equipmentKey : undefined,
        filter_difficulty: difficultyKey.length > 0 ? difficultyKey : undefined,
        page_offset: pageParam * PAGE_SIZE,
        page_limit: PAGE_SIZE,
      })
      if (error) throw error
      return (data ?? []) as Exercise[]
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    enabled,
  })

  const data = query.data?.pages.flat() ?? []
  return {
    data,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  }
}
