import {
  computeBalanceScore,
  type MuscleTaxonomy,
  setsVectorFromRows,
} from "@/lib/trainingBalance"
import {
  hasEnoughBalanceData,
  type VolumeByMuscleResult,
} from "@/lib/volumeByMuscleGroup"

export type MuscleSetCredits = Record<MuscleTaxonomy, number>

export type BalanceVm =
  | { status: "empty" }
  | {
      status: "ok"
      score: number
      scoreDelta: number | null
      current: MuscleSetCredits
      prior?: MuscleSetCredits
    }

function radarValuesFromRows(
  muscles: VolumeByMuscleResult["muscles"],
): MuscleSetCredits {
  const byName = new Map(muscles.map((row) => [row.muscle_group, row.total_sets]))
  return {
    Pectoraux: byName.get("Pectoraux") ?? 0,
    Dos: byName.get("Dos") ?? 0,
    Épaules: byName.get("Épaules") ?? 0,
    Biceps: byName.get("Biceps") ?? 0,
    Triceps: byName.get("Triceps") ?? 0,
    Quadriceps: byName.get("Quadriceps") ?? 0,
    Ischios: byName.get("Ischios") ?? 0,
    Fessiers: byName.get("Fessiers") ?? 0,
    Adducteurs: byName.get("Adducteurs") ?? 0,
    Mollets: byName.get("Mollets") ?? 0,
    Abdos: byName.get("Abdos") ?? 0,
    Trapèzes: byName.get("Trapèzes") ?? 0,
    Lombaires: byName.get("Lombaires") ?? 0,
  }
}

export function buildBalanceVm(
  current: VolumeByMuscleResult,
  previous: VolumeByMuscleResult | null,
  includeDeltas: boolean,
): BalanceVm {
  if (!hasEnoughBalanceData(current)) return { status: "empty" }

  const vec = setsVectorFromRows(current.muscles)
  const score = computeBalanceScore(vec)
  const priorOk =
    includeDeltas && previous != null && hasEnoughBalanceData(previous)
  const scoreDelta = priorOk
    ? score - computeBalanceScore(setsVectorFromRows(previous.muscles))
    : null

  return {
    status: "ok",
    score,
    scoreDelta,
    current: radarValuesFromRows(current.muscles),
    prior:
      includeDeltas && previous != null
        ? radarValuesFromRows(previous.muscles)
        : undefined,
  }
}
