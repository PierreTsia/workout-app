export type WeightUnit = "kg" | "lbs"

export interface IntraSessionSuggestion {
  weight: number
  reps: string
}

const INCREMENT: Record<WeightUnit, number> = { kg: 2.5, lbs: 5 }

export function computeIntraSessionSuggestion(
  prevRir: number,
  prevWeight: number,
  prevReps: string,
  unit: WeightUnit,
): IntraSessionSuggestion {
  const inc = INCREMENT[unit]

  if (prevRir === 0) {
    if (prevWeight <= 0) return { weight: 0, reps: prevReps }
    return { weight: Math.max(inc, prevWeight - inc), reps: prevReps }
  }
  if (prevRir >= 4) {
    return { weight: prevWeight + inc, reps: prevReps }
  }
  return { weight: prevWeight, reps: prevReps }
}
