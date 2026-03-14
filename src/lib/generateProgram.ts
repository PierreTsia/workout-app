import type { UserExperience, UserEquipment, ExerciseAlternative } from "@/types/onboarding"

interface RepRangeResult {
  reps: string
  sets: number
  restSeconds: number
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
    return { reps: repRange, sets: baseSets, restSeconds: baseRest }
  }

  switch (experience) {
    case "beginner":
      return {
        reps: String(parsed.max),
        sets: Math.max(baseSets, 3),
        restSeconds: baseRest + 15,
      }
    case "intermediate":
      return {
        reps: String(Math.round((parsed.min + parsed.max) / 2)),
        sets: Math.min(Math.max(baseSets, 3), 4),
        restSeconds: baseRest,
      }
    case "advanced":
      return {
        reps: String(parsed.min),
        sets: Math.min(baseSets + 1, 5),
        restSeconds: Math.max(baseRest - 15, 30),
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
