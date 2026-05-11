// PWA hook for the Quick Workout AI preview phase (T127, #342). Replaces
// the legacy generic AI workout hook — same external shape, new endpoint
// (`generate-quick-workout`), and the underlying quota now lives under
// `source = 'quick_workout'` (T126).
//
// Responsibilities:
//   1. POST constraints to /functions/v1/generate-quick-workout (session JWT)
//   2. Map status codes to typed error messages the UI can branch on
//      (`quota_exceeded` / `timeout` / network)
//   3. Hydrate the returned `exerciseIds` against the local exercise pool
//      so `PreviewStep` doesn't need a second fetch.
//
// The save path is intentionally OUT OF SCOPE — `useCreateQuickWorkout`
// keeps owning the write side until T128 lands `commit-quick-workout`.

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

/**
 * Returns the locale tag the Edge function expects. Mirrors the resolution
 * `generate-program` uses so prompt language stays consistent across the
 * two AI flows.
 */
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

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes("fetch")) return true
  if (!(err instanceof Error)) return false
  if (err.name === "FunctionsFetchError") return true
  if (err.name === "FunctionsRelayError") return true
  if (err.message.includes("name resolution")) return true
  return false
}

export function isQuotaError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("quota_exceeded")
}

interface ServerResponse {
  exerciseIds: string[]
  rationale?: string
}

async function callGenerateQuickWorkout(body: Record<string, unknown>): Promise<ServerResponse> {
  const { data, error } = await supabase.functions.invoke("generate-quick-workout", { body })
  if (error) {
    const ctx = invokeErrorContext(error)
    if (ctx?.status === 429) throw new Error("quota_exceeded")
    if (ctx?.status === 504) throw new Error("timeout")
    throw error
  }
  return data as ServerResponse
}

async function hydrateExercises(
  exerciseIds: string[],
  pool: Exercise[],
): Promise<Exercise[]> {
  // The AI's `exerciseIds` order is intent (warm-up → compound → accessory,
  // pull-then-push, etc.). Rebuild the result by iterating that list and
  // looking each id up in the unified (pool || fetched) map — keeps the
  // model's sequencing intact even when Postgres returns the fallback
  // fetch in arbitrary order. PR #347 review C5.
  const poolMap = new Map(pool.map((e) => [e.id, e] as const))
  const missingIds = exerciseIds.filter((id) => !poolMap.has(id))

  const fetched: Exercise[] = await (async () => {
    if (missingIds.length === 0) return []
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .in("id", missingIds)
    if (error) throw error
    return (data ?? []) as Exercise[]
  })()

  const fetchedMap = new Map(fetched.map((ex) => [ex.id, ex] as const))

  return exerciseIds
    .map((id) => poolMap.get(id) ?? fetchedMap.get(id))
    .filter((ex): ex is Exercise => ex !== undefined)
}

function buildWorkoutName(constraints: GeneratorConstraints): string {
  const focusLabel = constraints.muscleGroups.includes("full-body")
    ? "Full Body"
    : constraints.muscleGroups.join(" + ")
  const equipLabel = formatEquipmentLabelForName(constraints.equipmentCategories)
  return `AI: ${focusLabel} / ${equipLabel} / ${constraints.duration}min`
}

export function useGenerateQuickWorkoutPreview({ exercisePool }: AIGenerateContext) {
  return useMutation({
    mutationFn: async (constraints: GeneratorConstraints): Promise<GeneratedWorkout> => {
      const focusAreas = trimFocusAreas(constraints.focusAreas)
      const body: Record<string, unknown> = {
        duration: constraints.duration,
        equipmentCategories: constraints.equipmentCategories,
        muscleGroups: constraints.muscleGroups,
        locale: localeForAI(),
      }
      if (focusAreas) body.focusAreas = focusAreas

      const { exerciseIds, rationale } = await callGenerateQuickWorkout(body)
      if (!exerciseIds?.length) throw new Error("AI returned no exercises")

      const resolved = await hydrateExercises(exerciseIds, exercisePool)
      const { setsPerExercise } = VOLUME_MAP[constraints.duration as Duration]
      const rationaleText =
        typeof rationale === "string" && rationale.trim().length > 0
          ? rationale.trim()
          : undefined

      return {
        exercises: resolved.map((ex) => buildExercise(ex, setsPerExercise)),
        name: buildWorkoutName(constraints),
        hasFallback: false,
        ...(rationaleText ? { rationale: rationaleText } : {}),
      }
    },
    meta: { isNetworkError },
  })
}
