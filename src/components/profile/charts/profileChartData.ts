import { MUSCLE_TAXONOMY, type MuscleTaxonomy } from "@/lib/trainingBalance"

export type MixSeries = {
  programme: readonly number[]
  quickWorkout: readonly number[]
  circuits: readonly number[]
}

export type MixPercentRow = {
  category: string
  programme: number
  quickWorkout: number
  circuits: number
}

export function toMixPercentRows(
  categories: readonly string[],
  series: MixSeries,
): MixPercentRow[] {
  return categories.map((category, i) => {
    const programme = series.programme[i] ?? 0
    const quickWorkout = series.quickWorkout[i] ?? 0
    const circuits = series.circuits[i] ?? 0
    const total = programme + quickWorkout + circuits
    if (total === 0) {
      return { category, programme: 0, quickWorkout: 0, circuits: 0 }
    }
    return {
      category,
      programme: (programme / total) * 100,
      quickWorkout: (quickWorkout / total) * 100,
      circuits: (circuits / total) * 100,
    }
  })
}

export type RecordsComboSeries = {
  prs: readonly number[]
  rir0: readonly (number | null)[]
}

export type RecordsComboRow = {
  category: string
  prs: number
  rir0: number | null
}

export function toRecordsComboRows(
  categories: readonly string[],
  series: RecordsComboSeries,
): RecordsComboRow[] {
  return categories.map((category, i) => ({
    category,
    prs: series.prs[i] ?? 0,
    rir0: series.rir0[i] ?? null,
  }))
}

export type MuscleRadarValues = Record<MuscleTaxonomy, number>

export type MuscleRadarSeries = {
  current: MuscleRadarValues
  prior?: MuscleRadarValues
}

export type MuscleRadarRow = {
  muscle: MuscleTaxonomy
  current: number
  prior?: number
}

export function toRadarRows(series: MuscleRadarSeries): MuscleRadarRow[] {
  return MUSCLE_TAXONOMY.map((muscle) => {
    const current = series.current[muscle]
    if (series.prior === undefined) {
      return { muscle, current }
    }
    return { muscle, current, prior: series.prior[muscle] }
  })
}

/** T0: radar fixture is 0–1. Scale to credited-set integers until T230 wires RPC sets. */
export const PIERRE_SET_CREDIT_SCALE = 20

export type MuscleSetRank = {
  muscle: MuscleTaxonomy
  sets: number
  fill: number
}

export function toMuscleSetRanks(values: MuscleRadarValues): MuscleSetRank[] {
  const rows = MUSCLE_TAXONOMY.map((muscle) => ({
    muscle,
    sets: Math.round(values[muscle] * PIERRE_SET_CREDIT_SCALE),
  }))
  const peak = rows.reduce((max, row) => Math.max(max, row.sets), 0)
  const ranked = rows.map((row) => ({
    ...row,
    fill: peak === 0 ? 0 : row.sets / peak,
  }))
  return [...ranked].sort(
    (a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle),
  )
}
