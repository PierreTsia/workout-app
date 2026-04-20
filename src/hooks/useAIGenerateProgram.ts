import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { buildExercise } from "@/lib/generateWorkout"
import { VOLUME_MAP } from "@/lib/generatorConfig"
import type { ExerciseListItem } from "@/types/database"
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
  // Slim catalog is sufficient — the generator only reads id + secondary_muscles
  // (via `buildExercise` / `isCompound`); rich fields (instructions, etc.) are
  // never consumed in the AI program flow.
  exercisePool: ExerciseListItem[]
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes("fetch")) return true
  if (err instanceof Error && err.name === "FunctionsFetchError") return true
  return false
}

function isQuotaError(err: unknown): boolean {
  if (err instanceof Error && err.message.includes("quota_exceeded")) return true
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

      if (error) {
        const ctx = (error as Record<string, unknown>).context as Response | undefined
        if (ctx?.status === 429) throw new Error("quota_exceeded")
        if (ctx?.status === 504) throw new Error("timeout")
        throw error
      }
      if (!data) throw new Error("Empty response from generate-program")

      const response = data as EdgeFunctionResponse
      if (response.error) throw new Error(response.error)
      if (!response.days?.length) throw new Error("AI returned no program days")

      const allIds = new Set<string>()
      for (const day of response.days) {
        for (const id of day.exercise_ids) allIds.add(id)
      }

      const poolMap = new Map(exercisePool.map((e) => [e.id, e]))
      const resolved = new Map<string, ExerciseListItem>()
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
        // Fallback for ids the slim pool didn't have (rare: newly added exercise
        // not yet in `exercise-library` cache). Select the same slim shape.
        const { data: fetched, error: fetchError } = await supabase
          .from("exercises")
          .select(
            "id, name, name_en, emoji, muscle_group, equipment, image_url, difficulty_level, is_system, measurement_type, default_duration_seconds, secondary_muscles",
          )
          .in("id", missingIds)

        if (fetchError) throw fetchError
        for (const ex of (fetched ?? []) as unknown as ExerciseListItem[]) {
          resolved.set(ex.id, ex)
        }
      }

      const duration = constraints.duration as Duration
      const { setsPerExercise } = VOLUME_MAP[duration] ?? VOLUME_MAP[60]

      const days: AIGeneratedDay[] = response.days.map((day) => {
        const unresolved = day.exercise_ids.filter((id) => !resolved.has(id))
        if (unresolved.length > 0) {
          console.warn(`[AI Program] ${unresolved.length} exercise(s) could not be resolved:`, unresolved)
        }

        return {
          label: day.label,
          muscleFocus: day.muscle_focus,
          exercises: day.exercise_ids
            .map((id) => resolved.get(id))
            .filter((ex): ex is ExerciseListItem => ex != null)
            .map((ex) => buildExercise(ex, setsPerExercise)),
        }
      })

      return {
        rationale: response.rationale,
        days,
      }
    },
    meta: { isNetworkError },
  })
}

export { isNetworkError, isQuotaError }
