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
  currentSets: number
  priorSets?: number
}

export function scaleRadarCredits(values: MuscleRadarValues): MuscleRadarValues {
  return {
    Pectoraux: values.Pectoraux * PIERRE_SET_CREDIT_SCALE,
    Dos: values.Dos * PIERRE_SET_CREDIT_SCALE,
    Épaules: values.Épaules * PIERRE_SET_CREDIT_SCALE,
    Biceps: values.Biceps * PIERRE_SET_CREDIT_SCALE,
    Triceps: values.Triceps * PIERRE_SET_CREDIT_SCALE,
    Quadriceps: values.Quadriceps * PIERRE_SET_CREDIT_SCALE,
    Ischios: values.Ischios * PIERRE_SET_CREDIT_SCALE,
    Fessiers: values.Fessiers * PIERRE_SET_CREDIT_SCALE,
    Adducteurs: values.Adducteurs * PIERRE_SET_CREDIT_SCALE,
    Mollets: values.Mollets * PIERRE_SET_CREDIT_SCALE,
    Abdos: values.Abdos * PIERRE_SET_CREDIT_SCALE,
    Trapèzes: values.Trapèzes * PIERRE_SET_CREDIT_SCALE,
    Lombaires: values.Lombaires * PIERRE_SET_CREDIT_SCALE,
  }
}

export function toRadarRows(series: MuscleRadarSeries): MuscleRadarRow[] {
  const prior = series.prior
  const peak = Math.max(
    1,
    ...MUSCLE_TAXONOMY.map((muscle) => series.current[muscle]),
    ...(prior == null ? [] : MUSCLE_TAXONOMY.map((muscle) => prior[muscle])),
  )
  return MUSCLE_TAXONOMY.map((muscle) => {
    const currentSets = series.current[muscle]
    if (prior === undefined) {
      return { muscle, current: currentSets / peak, currentSets }
    }
    const priorSets = prior[muscle]
    return {
      muscle,
      current: currentSets / peak,
      prior: priorSets / peak,
      currentSets,
      priorSets,
    }
  })
}

/** T0 fixture is 0–1. Multiply to credited sets before the radar/ranks consume a VM. */
export const PIERRE_SET_CREDIT_SCALE = 20

export type MuscleSetRank = {
  muscle: MuscleTaxonomy
  sets: number
  fill: number
}

export function toMuscleSetRanks(values: MuscleRadarValues): MuscleSetRank[] {
  const peakRaw = MUSCLE_TAXONOMY.reduce(
    (max, muscle) => Math.max(max, values[muscle]),
    0,
  )
  const unit = peakRaw > 0 && peakRaw <= 1 ? PIERRE_SET_CREDIT_SCALE : 1
  const rows = MUSCLE_TAXONOMY.map((muscle) => ({
    muscle,
    sets: Math.round(values[muscle] * unit),
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
