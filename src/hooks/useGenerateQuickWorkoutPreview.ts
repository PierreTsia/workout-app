// PWA hook for the Quick Workout AI preview phase (T127 / T170, #342).

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
  GeneratedDayItem,
  GeneratedWorkout,
  Duration,
} from "@/types/generator"

interface AIGenerateContext {
  exercisePool: Exercise[]
}

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

type ServerDayItem =
  | string
  | {
      type: "circuit"
      label?: string
      mode?: "rounds" | "amrap"
      cap_minutes?: number
      rounds?: number
      rest_seconds?: number
      transition_seconds?: number
      benchmark_slug?: string
      exercises?: Array<{ exercise_id: string; amount: number; weight_kg: number }>
    }

interface ServerResponse {
  exerciseIds: string[]
  items?: ServerDayItem[]
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
): Promise<Map<string, Exercise>> {
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

  const map = new Map(poolMap)
  for (const ex of fetched) map.set(ex.id, ex)
  return map
}

function buildWorkoutName(constraints: GeneratorConstraints): string {
  const focusLabel = constraints.muscleGroups.includes("full-body")
    ? "Full Body"
    : constraints.muscleGroups.join(" + ")
  const equipLabel = formatEquipmentLabelForName(constraints.equipmentCategories)
  return `AI: ${focusLabel} / ${equipLabel} / ${constraints.duration}min`
}

function buildDayItems(
  items: ServerDayItem[],
  byId: Map<string, Exercise>,
  setsPerExercise: number,
): GeneratedDayItem[] {
  return items.flatMap((item): GeneratedDayItem[] => {
    if (typeof item === "string") {
      const ex = byId.get(item)
      if (!ex) return []
      return [{ kind: "solo", exercise: buildExercise(ex, setsPerExercise) }]
    }
    if (item.type !== "circuit") return []
    if (item.benchmark_slug) {
      return [
        {
          kind: "circuit",
          circuit: {
            benchmarkSlug: item.benchmark_slug,
            rounds: 1,
            restSeconds: 0,
            transitionSeconds: 0,
            exercises: [],
          },
        },
      ]
    }
    const nested = (item.exercises ?? []).flatMap((n) => {
      const ex = byId.get(n.exercise_id)
      if (!ex) return []
      return [{ exercise: ex, amount: n.amount, weightKg: n.weight_kg }]
    })
    if (nested.length < 2) return []
    const isAmrap = item.mode === "amrap"
    return [
      {
        kind: "circuit",
        circuit: {
          ...(item.label ? { label: item.label } : {}),
          ...(isAmrap
            ? {
                mode: "amrap" as const,
                capMinutes: item.cap_minutes ?? 20,
                rounds: 1,
                restSeconds: 0,
                transitionSeconds: 0,
              }
            : {
                rounds: item.rounds ?? 3,
                restSeconds: item.rest_seconds ?? 90,
                transitionSeconds: item.transition_seconds ?? 0,
              }),
          exercises: nested,
        },
      },
    ]
  })
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

      const { exerciseIds, items, rationale } = await callGenerateQuickWorkout(body)
      const daySource =
        Array.isArray(items) && items.length > 0
          ? items
          : (exerciseIds ?? []).map((id) => id)

      if (!daySource.length) throw new Error("AI returned no exercises")

      const allIds = daySource.flatMap((item) =>
        typeof item === "string"
          ? [item]
          : (item.exercises ?? []).map((e) => e.exercise_id),
      )
      const byId = await hydrateExercises(allIds, exercisePool)
      const { setsPerExercise } = VOLUME_MAP[constraints.duration as Duration]
      const dayItems = buildDayItems(daySource, byId, setsPerExercise)
      if (dayItems.length === 0) throw new Error("AI returned no exercises")

      const rationaleText =
        typeof rationale === "string" && rationale.trim().length > 0
          ? rationale.trim()
          : undefined

      return {
        exercises: dayItems
          .filter((i): i is Extract<GeneratedDayItem, { kind: "solo" }> => i.kind === "solo")
          .map((i) => i.exercise),
        dayItems,
        name: buildWorkoutName(constraints),
        hasFallback: false,
        ...(rationaleText ? { rationale: rationaleText } : {}),
      }
    },
    meta: { isNetworkError },
  })
}
