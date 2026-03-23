import { useMutation } from "@tanstack/react-query"
import i18n from "@/lib/i18n"
import { supabase } from "@/lib/supabase"
import { trimFocusAreas } from "@/lib/aiFocusAreas"
import { buildExercise } from "@/lib/generateWorkout"
import { formatEquipmentLabelForName } from "@/lib/equipmentSelection"
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

function isQuotaError(err: unknown): boolean {
  if (err instanceof Error && err.message.includes("quota_exceeded")) return true
  return false
}

/** Primary tag aligned with `supportedLngs` — matches generate-program `locale` usage. */
function localeForAI(): "en" | "fr" {
  const lng = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase()
  return lng.startsWith("fr") ? "fr" : "en"
}

function invokeErrorContext(err: unknown): Response | undefined {
  if (typeof err !== "object" || err === null) return undefined
  if (!("context" in err)) return undefined
  const ctx = err.context
  return ctx instanceof Response ? ctx : undefined
}

export function useAIGenerateWorkout({ exercisePool }: AIGenerateContext) {
  return useMutation({
    mutationFn: async (
      constraints: GeneratorConstraints,
    ): Promise<GeneratedWorkout> => {
      const focusAreas = trimFocusAreas(constraints.focusAreas)
      const body: Record<string, unknown> = {
        duration: constraints.duration,
        equipmentCategories: constraints.equipmentCategories,
        muscleGroups: constraints.muscleGroups,
        locale: localeForAI(),
      }
      if (focusAreas) body.focusAreas = focusAreas

      const { data, error } = await supabase.functions.invoke(
        "generate-workout",
        { body },
      )

      if (error) {
        const ctx = invokeErrorContext(error)
        if (ctx?.status === 429) throw new Error("quota_exceeded")
        if (ctx?.status === 504) throw new Error("timeout")
        throw error
      }

      const { exerciseIds, rationale } = data as {
        exerciseIds: string[]
        rationale?: string
      }
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

      const focusLabel = constraints.muscleGroups.includes("full-body")
        ? "Full Body"
        : constraints.muscleGroups.join(" + ")
      const equipLabel = formatEquipmentLabelForName(
        constraints.equipmentCategories,
      )

      const rationaleText =
        typeof rationale === "string" && rationale.trim().length > 0
          ? rationale.trim()
          : undefined

      return {
        exercises: resolved.map((ex) => buildExercise(ex, setsPerExercise)),
        name: `AI: ${focusLabel} / ${equipLabel} / ${constraints.duration}min`,
        hasFallback: false,
        ...(rationaleText ? { rationale: rationaleText } : {}),
      }
    },
    meta: { isNetworkError },
  })
}

export { isNetworkError, isQuotaError }
