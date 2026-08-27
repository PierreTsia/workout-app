import { MUSCLE_TAXONOMY } from "@/lib/trainingBalance"
import { bodyMapDataFromMuscleVolume } from "@/lib/volumeByMuscleGroup"
import { intentBalanceCredits } from "./scoreProgram"
import type { ProgramIntent } from "./types"

/** Heatmap of the week as written — same credits as Program Balance. */
export function bodyMapFromIntent(intent: ProgramIntent) {
  const credits = intentBalanceCredits(intent)
  const muscles = MUSCLE_TAXONOMY.flatMap((muscle) => {
    const total_sets = credits.get(muscle) ?? 0
    if (total_sets <= 0) return []
    return [
      {
        muscle_group: muscle,
        total_sets,
        total_volume_kg: 0,
        exercise_count: 0,
      },
    ]
  })
  return bodyMapDataFromMuscleVolume(muscles)
}

export type ProgramBodyMap = ReturnType<typeof bodyMapFromIntent>
