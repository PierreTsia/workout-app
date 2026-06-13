import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { buildBlockInsertRows } from "@/lib/blockPersistence"
import type { ExerciseListItem } from "@/types/database"

interface CreateBlockInput {
  dayId: string
  libraryExercises: ExerciseListItem[]
  /** Highest existing sort_order in the day across solos and blocks; -1 if empty. */
  existingMaxSortOrder: number
}

/**
 * Creates an Exercise Block (#351): inserts the `exercise_blocks` row, then its
 * `block_exercises` with the returned `block_id`. Per-round prescriptions are
 * seeded from catalog defaults (see `buildBlockInsertRows`).
 */
export function useCreateBlock() {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dayId,
      libraryExercises,
      existingMaxSortOrder,
    }: CreateBlockInput) => {
      if (!user) throw new Error("Not authenticated")

      const { block, blockExercises } = buildBlockInsertRows({
        dayId,
        libraryExercises,
        existingMaxSortOrder,
      })

      const { data: created, error: blockError } = await supabase
        .from("exercise_blocks")
        .insert(block)
        .select("id")
        .single()
      if (blockError) throw blockError

      const rows = blockExercises.map((be) => ({
        ...be,
        block_id: created.id,
      }))
      const { error: exError } = await supabase
        .from("block_exercises")
        .insert(rows)
      if (exError) throw exError

      return { blockId: created.id }
    },
    onSuccess: (_data, { dayId }) => {
      qc.invalidateQueries({ queryKey: ["exercise-blocks", dayId] })
      qc.invalidateQueries({ queryKey: ["workout-days"] })
    },
  })
}
