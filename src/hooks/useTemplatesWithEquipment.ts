import { useMemo } from "react"
import { useTemplates } from "@/hooks/useTemplates"
import { useExerciseAlternatives } from "@/hooks/useExerciseAlternatives"
import type { ProgramTemplate, ExerciseAlternative, UserEquipment } from "@/types/onboarding"

export type EnrichedTemplate = ProgramTemplate & { equipmentContexts: UserEquipment[] }

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

export function useTemplatesWithEquipment() {
  const { data: templates, isLoading: templatesLoading, error: templatesError } = useTemplates()
  const { data: alternatives, isLoading: alternativesLoading, error: alternativesError } = useExerciseAlternatives()

  const enriched = useMemo(() => {
    if (!templates || !alternatives) return []
    return templates.map((t) => ({
      ...t,
      equipmentContexts: deriveEquipmentContexts(t, alternatives),
    }))
  }, [templates, alternatives])

  return {
    templates: enriched,
    isLoading: templatesLoading || alternativesLoading,
    error: templatesError ?? alternativesError,
  }
}
