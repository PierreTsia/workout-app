import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { buildGeneratedCircuitInsertRows } from "@/lib/blockPersistence"
import {
  buildWorkoutExerciseInsertRow,
  buildWorkoutExerciseInsertRowsForDay,
} from "@/lib/programPersistence"
import type {
  GeneratedCircuit,
  GeneratedDayItem,
  GeneratedWorkout,
} from "@/types/generator"

interface CreateQuickWorkoutInput {
  workout: GeneratedWorkout
  saveAsDraft?: boolean
}

function dayItemsForPersist(workout: GeneratedWorkout): GeneratedDayItem[] {
  if (workout.dayItems && workout.dayItems.length > 0) return workout.dayItems
  return workout.exercises.map((exercise) => ({ kind: "solo" as const, exercise }))
}

export function useCreateQuickWorkout() {
  const user = useAtomValue(authAtom)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workout, saveAsDraft }: CreateQuickWorkoutInput) => {
      if (!user) throw new Error("Not authenticated")

      const { data: day, error: dayError } = await supabase
        .from("workout_days")
        .insert({
          user_id: user.id,
          program_id: null,
          label: workout.name,
          emoji: "⚡",
          sort_order: 0,
          ...(saveAsDraft ? { saved_at: new Date().toISOString() } : {}),
        })
        .select("id")
        .single()
      if (dayError) throw dayError

      const dayItems = dayItemsForPersist(workout)
      const hasCircuit = dayItems.some((item) => item.kind === "circuit")

      if (!hasCircuit) {
        const exerciseRows = buildWorkoutExerciseInsertRowsForDay(
          day.id,
          dayItems.flatMap((item) =>
            item.kind === "solo" ? [item.exercise] : [],
          ),
        )
        const { error: exError } = await supabase
          .from("workout_exercises")
          .insert(exerciseRows)
        if (exError) throw exError
        return { dayId: day.id, wasDraft: !!saveAsDraft }
      }

      const soloRows = dayItems.flatMap((item, sortOrder) =>
        item.kind === "solo"
          ? [buildWorkoutExerciseInsertRow(day.id, item.exercise, sortOrder)]
          : [],
      )
      if (soloRows.length > 0) {
        const { error: exError } = await supabase
          .from("workout_exercises")
          .insert(soloRows)
        if (exError) throw exError
      }

      const circuits = dayItems
        .map((item, sortOrder) =>
          item.kind === "circuit"
            ? ({ circuit: item.circuit, sortOrder } as const)
            : null,
        )
        .filter(
          (entry): entry is { circuit: GeneratedCircuit; sortOrder: number } =>
            entry !== null,
        )

      for (const { circuit, sortOrder } of circuits) {
        const { block, blockExercises } = buildGeneratedCircuitInsertRows(
          day.id,
          sortOrder,
          circuit,
        )
        const { data: created, error: blockError } = await supabase
          .from("exercise_blocks")
          .insert(block)
          .select("id")
          .single()
        if (blockError) throw blockError

        const { error: beError } = await supabase.from("block_exercises").insert(
          blockExercises.map((be) => ({ ...be, block_id: created.id })),
        )
        if (beError) throw beError
      }

      return { dayId: day.id, wasDraft: !!saveAsDraft }
    },
    onSuccess: ({ wasDraft }) => {
      if (wasDraft) {
        queryClient.invalidateQueries({ queryKey: ["saved-workouts"] })
      }
    },
  })
}
