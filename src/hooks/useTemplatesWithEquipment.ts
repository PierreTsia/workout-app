import { useMemo } from "react"
import { useTemplates } from "@/hooks/useTemplates"
import { useExerciseAlternatives } from "@/hooks/useExerciseAlternatives"
import { deriveEquipmentContexts } from "@/lib/deriveEquipmentContexts"
import type { ProgramTemplate, UserEquipment } from "@/types/onboarding"

export type EnrichedTemplate = ProgramTemplate & { equipmentContexts: UserEquipment[] }

export { deriveEquipmentContexts }

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
