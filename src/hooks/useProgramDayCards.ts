import { useQuery } from "@tanstack/react-query"
import type { DayCardItem } from "@/components/library/DayCard"
import {
  toDayCardItems,
  type DayCardBlock,
  type DayCardExercise,
} from "@/components/library/toDayCardItems"
import { LABEL_EXERCISE_SELECT } from "@/lib/exerciseSelects"
import { supabase } from "@/lib/supabase"

export type ProgramDayCard = {
  id: string
  label: string
  exerciseCount: number
  items: DayCardItem[]
}

type DayRow = {
  id: string
  emoji: string
  label: string
  sort_order: number
  workout_exercises: DayCardExercise[]
  exercise_blocks: DayCardBlock[] | null
}

const DAY_CARDS_SELECT = [
  "id",
  "emoji",
  "label",
  "sort_order",
  `workout_exercises(id, emoji_snapshot, name_snapshot, sets, reps, rest_seconds, sort_order, exercise:exercises(${LABEL_EXERCISE_SELECT}))`,
  `exercise_blocks(id, label, rounds, sort_order, exercises:block_exercises(id, position))`,
].join(", ")

export function useProgramDayCards(programId: string | null) {
  return useQuery({
    queryKey: ["program-day-cards", programId],
    enabled: programId != null,
    queryFn: async (): Promise<ProgramDayCard[]> => {
      const { data, error } = await supabase
        .from("workout_days")
        .select(DAY_CARDS_SELECT)
        .eq("program_id", programId!)
        .order("sort_order")
        .returns<DayRow[]>()

      if (error) throw error

      return (data ?? []).map((day) => {
        const blocks = (day.exercise_blocks ?? []).map((block) => ({
          ...block,
          exercises: [...block.exercises].sort((a, b) => a.position - b.position),
        }))
        const items = toDayCardItems(day.workout_exercises, blocks)
        return {
          id: day.id,
          label: `${day.emoji} ${day.label}`,
          exerciseCount: items.length,
          items,
        }
      })
    },
  })
}
