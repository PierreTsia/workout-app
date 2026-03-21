import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { buildExercise } from "@/lib/generateWorkout"
import { VOLUME_MAP } from "@/lib/generatorConfig"
import type { Exercise } from "@/types/database"
import type { Duration } from "@/types/generator"
import type {
  GenerateProgramConstraints,
  AIGeneratedProgram,
  AIGeneratedDay,
} from "@/types/aiProgram"

interface EdgeFunctionDay {
  label: string
  muscle_focus: string
  exercise_ids: string[]
}

interface EdgeFunctionResponse {
  rationale: string
  days: EdgeFunctionDay[]
  error?: string
}

interface AIGenerateProgramContext {
  exercisePool: Exercise[]
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes("fetch")) return true
  if (err instanceof Error && err.name === "FunctionsFetchError") return true
  return false
}

export function useAIGenerateProgram({ exercisePool }: AIGenerateProgramContext) {
  return useMutation({
    mutationFn: async (
      constraints: GenerateProgramConstraints,
    ): Promise<AIGeneratedProgram> => {
      const { data, error } = await supabase.functions.invoke(
        "generate-program",
        { body: constraints },
      )

      if (error) throw error

      const response = data as EdgeFunctionResponse
      if (response.error) throw new Error(response.error)
      if (!response.days?.length) throw new Error("AI returned no program days")

      const allIds = new Set<string>()
      for (const day of response.days) {
        for (const id of day.exercise_ids) allIds.add(id)
      }

      const poolMap = new Map(exercisePool.map((e) => [e.id, e]))
      const resolved = new Map<string, Exercise>()
      const missingIds: string[] = []

      for (const id of allIds) {
        const cached = poolMap.get(id)
        if (cached) {
          resolved.set(id, cached)
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
          resolved.set(ex.id, ex)
        }
      }

      const duration = constraints.duration as Duration
      const { setsPerExercise } = VOLUME_MAP[duration] ?? VOLUME_MAP[60]

      const days: AIGeneratedDay[] = response.days.map((day) => ({
        label: day.label,
        muscleFocus: day.muscle_focus,
        exercises: day.exercise_ids
          .map((id) => resolved.get(id))
          .filter((ex): ex is Exercise => ex != null)
          .map((ex) => buildExercise(ex, setsPerExercise)),
      }))

      return {
        rationale: response.rationale,
        days,
      }
    },
    meta: { isNetworkError },
  })
}

export { isNetworkError }
