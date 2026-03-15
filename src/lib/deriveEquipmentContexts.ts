import type { ProgramTemplate, ExerciseAlternative, UserEquipment } from "@/types/onboarding"

const BODYWEIGHT_EQUIPMENT = ["bodyweight", "body weight", "none"]

export function deriveEquipmentContexts(
  template: ProgramTemplate,
  alternatives: ExerciseAlternative[],
): UserEquipment[] {
  const contexts: UserEquipment[] = ["gym"]

  for (const ctx of ["home", "minimal"] as const) {
    const allCovered = template.template_days.every((day) =>
      day.template_exercises.every((te) => {
        const eq = te.exercise?.equipment?.toLowerCase() ?? ""
        if (BODYWEIGHT_EQUIPMENT.includes(eq)) return true
        return alternatives.some(
          (a) => a.exercise_id === te.exercise_id && a.equipment_context === ctx,
        )
      }),
    )
    if (allCovered) contexts.push(ctx)
  }

  return contexts
}
