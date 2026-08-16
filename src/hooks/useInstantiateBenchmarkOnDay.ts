import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { fetchExercisesByIds } from "@/lib/fetchExercisesByIds"
import {
  instantiateBenchmark,
  type InstantiateExerciseRow,
} from "@/lib/instantiateBenchmark"
import type { CatalogPreviewRow } from "@/lib/previewCatalogCircuit"

interface InstantiateBenchmarkOnDayInput {
  dayId: string
  catalog: CatalogPreviewRow
  existingMaxSortOrder: number
}

export function useInstantiateBenchmarkOnDay() {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dayId,
      catalog,
      existingMaxSortOrder,
    }: InstantiateBenchmarkOnDayInput) => {
      if (!user) throw new Error("Not authenticated")

      const rows = await fetchExercisesByIds<InstantiateExerciseRow>(
        catalog.rx.exercises.map((ex) => ex.exercise_id),
        "id, name, muscle_group, emoji",
      )
      const exerciseById = new Map(rows.map((row) => [row.id, row]))

      const { block, blockExercises } = instantiateBenchmark(catalog, {
        workoutDayId: dayId,
        sortOrder: existingMaxSortOrder + 1,
        exerciseById,
      })

      const { data: created, error: blockError } = await supabase
        .from("exercise_blocks")
        .insert(block)
        .select("id")
        .single()
      if (blockError) throw blockError

      const cells = blockExercises.map((be) => ({
        ...be,
        block_id: created.id,
      }))
      const { error: exError } = await supabase
        .from("block_exercises")
        .insert(cells)
      if (exError) throw exError

      return { blockId: created.id }
    },
    onSuccess: (_data, { dayId }) => {
      qc.invalidateQueries({ queryKey: ["exercise-blocks", dayId] })
      qc.invalidateQueries({ queryKey: ["workout-days"] })
    },
  })
}
