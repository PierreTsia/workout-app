import { MUSCLE_TAXONOMY, type MuscleTaxonomy } from "@/lib/trainingBalance"
import {
  bodyMapFromIntent,
  type ProgramBodyMap,
} from "./bodyMapFromIntent"
import { intentBalanceCredits } from "./scoreProgram"
import type { ProgramIntentDay } from "./types"

export type MuscleChip = {
  muscle: MuscleTaxonomy
  credit: number
}

export function dayBalanceCredits(
  day: ProgramIntentDay,
): ReadonlyMap<MuscleTaxonomy, number> {
  return intentBalanceCredits({ programId: day.id, days: [day] })
}

export function dayIntentToHeatmap(day: ProgramIntentDay): {
  data: ProgramBodyMap
  chips: readonly MuscleChip[]
} {
  const credits = dayBalanceCredits(day)
  const chips = MUSCLE_TAXONOMY.flatMap((muscle) => {
    const credit = credits.get(muscle) ?? 0
    return credit > 0 ? [{ muscle, credit }] : []
  }).sort((a, b) => b.credit - a.credit)

  return {
    data: bodyMapFromIntent({ programId: day.id, days: [day] }),
    chips,
  }
}
