import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { buildExercise } from "@/lib/generateWorkout"
import { VOLUME_MAP } from "@/lib/generatorConfig"
import type { Exercise } from "@/types/database"
import type {
  GeneratorConstraints,
  GeneratedWorkout,
  Duration,
} from "@/types/generator"

interface AIGenerateContext {
  exercisePool: Exercise[]
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes("fetch")) return true
  if (err instanceof Error && err.name === "FunctionsFetchError") return true
  return false
}

export function useAIGenerateWorkout({ exercisePool }: AIGenerateContext) {
  return useMutation({
    mutationFn: async (
      constraints: GeneratorConstraints,
    ): Promise<GeneratedWorkout> => {
      const { data, error } = await supabase.functions.invoke(
        "generate-workout",
        {
          body: {
            duration: constraints.duration,
            equipmentCategory: constraints.equipmentCategory,
            muscleGroups: constraints.muscleGroups,
          },
        },
      )

      if (error) throw error

      const { exerciseIds } = data as { exerciseIds: string[] }
      if (!exerciseIds?.length) {
        throw new Error("AI returned no exercises")
      }

      const poolMap = new Map(exercisePool.map((e) => [e.id, e]))
      const resolved: Exercise[] = []
      const missingIds: string[] = []

      for (const id of exerciseIds) {
        const cached = poolMap.get(id)
        if (cached) {
          resolved.push(cached)
        } else {
          missingIds.push(id)
        }
      }

      if (missingIds.length > 0) {
        const { data: fetched, error: fetchError } = await supabase
          .from("exercises")
          .select("*")
          .in("id", missingIds)

        if (fetchError) throw fetchError
        for (const ex of (fetched ?? []) as Exercise[]) {
          resolved.push(ex)
        }
      }

      const { setsPerExercise } = VOLUME_MAP[constraints.duration as Duration]

      return {
        exercises: resolved.map((ex) => buildExercise(ex, setsPerExercise)),
        name: `AI: ${constraints.muscleGroups.includes("full-body") ? "Full Body" : constraints.muscleGroups.join(" + ")} / ${constraints.duration}min`,
        hasFallback: false,
      }
    },
    meta: { isNetworkError },
  })
}

export { isNetworkError }
