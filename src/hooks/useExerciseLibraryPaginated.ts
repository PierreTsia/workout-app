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
  const query = useInfiniteQuery({
    queryKey: ["exercise-library-paginated", search.trim(), muscleGroup, equipment, difficulty],
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      let q = supabase.from("exercises").select("*")

      const term = search.trim()
      if (term.length > 0) {
        q = q.or(`name.ilike.%${term}%,name_en.ilike.%${term}%`)
      }
      if (muscleGroup) {
        q = q.eq("muscle_group", muscleGroup)
      }
      if (equipment.length > 0) {
        q = q.in("equipment", equipment)
      }
      if (difficulty.length > 0) {
        q = q.in("difficulty_level", difficulty)
      }

      q = q.order("muscle_group").order("name").range(from, to)
      const { data, error } = await q
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
