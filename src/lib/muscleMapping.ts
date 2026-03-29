import type { Muscle, IExerciseData } from "react-body-highlighter"

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
