import type { UserExperience, UserEquipment, ExerciseAlternative } from "@/types/onboarding"

export interface RepRangeResult {
  reps: string
  sets: number
  restSeconds: number
  repRangeMin: number | null
  repRangeMax: number | null
}

/**
 * Parse a rep_range like "8-12" into min/max. Returns null for non-numeric
 * ranges (e.g. "30-60s" for plank holds) — those are kept as-is.
 */
function parseRepRange(range: string): { min: number; max: number } | null {
  const match = range.match(/^(\d+)-(\d+)$/)
  if (!match) return null
  return { min: Number(match[1]), max: Number(match[2]) }
}

export function adaptForExperience(
  repRange: string,
  baseSets: number,
  baseRest: number,
  experience: UserExperience,
): RepRangeResult {
  const parsed = parseRepRange(repRange)

  if (!parsed) {
    return { reps: repRange, sets: baseSets, restSeconds: baseRest, repRangeMin: null, repRangeMax: null }
  }

  switch (experience) {
    case "beginner":
      return {
        reps: String(parsed.max),
        sets: Math.max(baseSets, 3),
        restSeconds: baseRest + 15,
        repRangeMin: parsed.min,
        repRangeMax: parsed.max,
      }
    case "intermediate":
      return {
        reps: String(Math.round((parsed.min + parsed.max) / 2)),
        sets: Math.min(Math.max(baseSets, 3), 4),
        restSeconds: baseRest,
        repRangeMin: parsed.min,
        repRangeMax: parsed.max,
      }
    case "advanced":
      return {
        reps: String(parsed.min),
        sets: Math.min(baseSets + 1, 5),
        restSeconds: Math.max(baseRest - 15, 30),
        repRangeMin: parsed.min,
        repRangeMax: parsed.max,
      }
  }
}

export function resolveEquipmentSwap(
  exerciseId: string,
  equipment: UserEquipment,
  alternatives: ExerciseAlternative[],
): string {
  if (equipment === "gym") return exerciseId

  const swap = alternatives.find(
    (a) => a.exercise_id === exerciseId && a.equipment_context === equipment,
  )
  return swap?.alternative_exercise_id ?? exerciseId
}
