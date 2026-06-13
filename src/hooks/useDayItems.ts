import { useMemo } from "react"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useExerciseBlocks } from "@/hooks/useExerciseBlocks"
import { buildDayItems } from "@/lib/dayItems"
import type { DayItem } from "@/types/database"

/**
 * The Unified Day Sequence (#351): a day's solo exercises and blocks merged
 * into one `sort_order`-ordered list of items. Single source of truth for the
 * builder and the session.
 */
export function useDayItems(dayId: string | null): {
  items: DayItem[]
  isLoading: boolean
} {
  const { data: exercises, isLoading: exercisesLoading } =
    useWorkoutExercises(dayId)
  const { data: blocks, isLoading: blocksLoading } = useExerciseBlocks(dayId)

  const items = useMemo(
    () => buildDayItems(exercises ?? [], blocks ?? []),
    [exercises, blocks],
  )

  return { items, isLoading: exercisesLoading || blocksLoading }
}
