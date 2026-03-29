import type { ProgramTemplate, ExerciseAlternative, UserEquipment } from "@/types/onboarding"

const BODYWEIGHT_EQUIPMENT = ["bodyweight", "body weight", "none"]

export function deriveEquipmentContexts(
  template: ProgramTemplate,
  alternatives: ExerciseAlternative[],
): UserEquipment[] {
  const extra = (["home", "minimal"] as const).filter((ctx) =>
    template.template_days.every((day) =>
      day.template_exercises.every((te) => {
        const eq = te.exercise?.equipment?.toLowerCase() ?? ""
        if (BODYWEIGHT_EQUIPMENT.includes(eq)) return true
        return alternatives.some(
          (a) => a.exercise_id === te.exercise_id && a.equipment_context === ctx,
        )
      }),
    ),
  )
  return ["gym", ...extra]
}
