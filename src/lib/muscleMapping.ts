import type { Muscle, IExerciseData } from "react-body-highlighter"

/**
 * Number of intensity steps for volume-based body maps (Balance tab).
 * Must match `BODY_MAP_INTENSITY_COLORS.length` in `BodyMap.tsx`.
 */
export const BODY_MAP_VOLUME_BUCKET_COUNT = 7

/**
 * Maps raw aggregated frequencies to 1..bucketCount so react-body-highlighter
 * can pick distinct colors (it uses frequency as a 1-based index into highlightedColors).
 */
export function bucketBodyMapFrequencies(
  data: IExerciseData[],
  bucketCount: number,
): IExerciseData[] {
  if (bucketCount < 1) return data

  const positiveFreqs = data
    .map((r) => r.frequency ?? 0)
    .filter((f) => f > 0)

  if (positiveFreqs.length === 0) return data

  const min = Math.min(...positiveFreqs)
  const max = Math.max(...positiveFreqs)
  const span = max - min
  const middle = Math.max(1, Math.ceil(bucketCount / 2))

  return data.map((r) => {
    const f = r.frequency ?? 0
    if (f <= 0) return r
    if (span === 0) return { ...r, frequency: middle }
    const t = (f - min) / span
    const bucket = 1 + Math.round((bucketCount - 1) * t)
    const clamped = Math.min(bucketCount, Math.max(1, bucket))
    return { ...r, frequency: clamped }
  })
}

/**
 * Maps French muscle taxonomy values (from `exercises.muscle_group`)
 * to SVG region slugs consumed by react-body-highlighter.
 *
 * Source taxonomy: scripts/audit-muscle-tags.ts → MUSCLE_TAXONOMY (13 values).
 */
const TAXONOMY_TO_SLUGS: Record<string, Muscle[]> = {
  Pectoraux: ["chest"],
  Dos: ["upper-back"],
  Épaules: ["front-deltoids", "back-deltoids"],
  Biceps: ["biceps"],
  Triceps: ["triceps"],
  Quadriceps: ["quadriceps"],
  Ischios: ["hamstring"],
  Fessiers: ["gluteal"],
  Adducteurs: ["adductor"],
  Mollets: ["calves"],
  Abdos: ["abs"],
  Trapèzes: ["trapezius"],
  Lombaires: ["lower-back"],
}

export function mapMuscleToSlugs(muscle: string): Muscle[] {
  return TAXONOMY_TO_SLUGS[muscle] ?? []
}

interface MuscleExerciseInput {
  name: string
  muscleGroup: string
  secondaryMuscles?: string[] | null
  sets: number
}

/**
 * Aggregates a list of exercises into the `IExerciseData[]` shape
 * expected by react-body-highlighter. Each muscle's frequency is
 * weighted by set count: primary gets the full set count, secondary
 * gets ceil(sets / 2).
 */
export function buildBodyMapData(
  exercises: MuscleExerciseInput[],
): IExerciseData[] {
  const frequencyBySlug = new Map<string, number>()
  const exercisesBySlug = new Map<string, Set<string>>()

  function contribute(slug: string, name: string, weight: number) {
    frequencyBySlug.set(slug, (frequencyBySlug.get(slug) ?? 0) + weight)
    const names = exercisesBySlug.get(slug) ?? new Set()
    names.add(name)
    exercisesBySlug.set(slug, names)
  }

  for (const ex of exercises) {
    for (const slug of mapMuscleToSlugs(ex.muscleGroup)) {
      contribute(slug, ex.name, ex.sets)
    }
    if (ex.secondaryMuscles) {
      const secondaryWeight = Math.ceil(ex.sets / 2)
      for (const sec of ex.secondaryMuscles) {
        for (const slug of mapMuscleToSlugs(sec)) {
          contribute(slug, ex.name, secondaryWeight)
        }
      }
    }
  }

  return [...frequencyBySlug].map(([slug, freq]) => ({
    name: [...exercisesBySlug.get(slug)!].join(", "),
    muscles: [slug as Muscle],
    frequency: freq,
  }))
}

/**
 * Builds IExerciseData for a single exercise (no aggregation).
 * Primary muscles get frequency 2, secondary get frequency 1,
 * so the library renders them with distinct intensity.
 */
export function buildSingleExerciseData(
  muscleGroup: string,
  secondaryMuscles?: string[] | null,
): IExerciseData[] {
  const primarySlugs = mapMuscleToSlugs(muscleGroup)
  const primary: IExerciseData[] =
    primarySlugs.length > 0
      ? [{ name: muscleGroup, muscles: primarySlugs, frequency: 2 }]
      : []

  const secondary: IExerciseData[] = (secondaryMuscles ?? [])
    .map((sec) => ({ name: sec, muscles: mapMuscleToSlugs(sec) }))
    .filter(({ muscles }) => muscles.length > 0)
    .map(({ name, muscles }) => ({ name, muscles, frequency: 1 }))

  return [...primary, ...secondary]
}
