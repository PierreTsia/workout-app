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

  const result: IExerciseData[] = []
  for (const [slug, freq] of frequencyBySlug) {
    const names = exercisesBySlug.get(slug)!
    result.push({
      name: [...names].join(", "),
      muscles: [slug as Muscle],
      frequency: freq,
    })
  }

  return result
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
  const data: IExerciseData[] = []

  const primarySlugs = mapMuscleToSlugs(muscleGroup)
  if (primarySlugs.length > 0) {
    data.push({ name: muscleGroup, muscles: primarySlugs, frequency: 2 })
  }

  if (secondaryMuscles) {
    for (const sec of secondaryMuscles) {
      const slugs = mapMuscleToSlugs(sec)
      if (slugs.length > 0) {
        data.push({ name: sec, muscles: slugs, frequency: 1 })
      }
    }
  }

  return data
}
