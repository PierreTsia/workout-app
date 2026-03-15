import { useState, useMemo } from "react"
import { useAtomValue } from "jotai"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { authAtom, sessionAtom } from "@/store/atoms"
import { supabase } from "@/lib/supabase"
import { useTemplatesWithEquipment } from "@/hooks/useTemplatesWithEquipment"
import { useUserPrograms } from "@/hooks/useUserPrograms"
import { useGenerateProgram } from "@/hooks/useGenerateProgram"
import { useTrackEvent } from "@/hooks/useTrackEvent"
import { LibraryFilterBar } from "@/components/library/LibraryFilterBar"
import { TemplateCard } from "@/components/library/TemplateCard"
import { TemplateDetailSheet } from "@/components/library/TemplateDetailSheet"
import { ActivateConfirmDialog } from "@/components/library/ActivateConfirmDialog"
import type { UserGoal, UserExperience, UserEquipment, UserProfile } from "@/types/onboarding"
import type { EnrichedTemplate } from "@/hooks/useTemplatesWithEquipment"

export function ProgramsTab() {
  const { t } = useTranslation("library")
  const user = useAtomValue(authAtom)
  const session = useAtomValue(sessionAtom)
  const { templates, isLoading: templatesLoading } = useTemplatesWithEquipment()
  const { data: userPrograms = [] } = useUserPrograms()
  const generateProgram = useGenerateProgram()
  const trackEvent = useTrackEvent()

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["user-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single()
      if (error) throw error
      return data as UserProfile
    },
  })

  const [selectedGoal, setSelectedGoal] = useState<UserGoal | null>(null)
  const [selectedExperience, setSelectedExperience] = useState<UserExperience | null>(null)
  const [equipmentOverride, setEquipmentOverride] = useState<UserEquipment | null | undefined>(undefined)
  const selectedEquipment = equipmentOverride !== undefined ? equipmentOverride : (profile?.equipment ?? null)

  const [detailTemplate, setDetailTemplate] = useState<EnrichedTemplate | null>(null)
  const [startTargetTemplate, setStartTargetTemplate] = useState<EnrichedTemplate | null>(null)

  const savedTemplateIds = useMemo(() => {
    const ids = new Set<string>()
    for (const p of userPrograms) {
      if (p.template_id && p.archived_at === null) {
        ids.add(p.template_id)
      }
    }
    return ids
  }, [userPrograms])

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      if (selectedGoal && tpl.primary_goal !== selectedGoal) return false
      if (selectedExperience && !tpl.experience_tags.includes(selectedExperience)) return false
      if (selectedEquipment && !tpl.equipmentContexts.includes(selectedEquipment)) return false
      return true
    })
  }, [templates, selectedGoal, selectedExperience, selectedEquipment])

  function handleSave(template: EnrichedTemplate) {
    if (!profile) return
    generateProgram.mutate(
      { template, profile, activate: false },
      {
        onSuccess: () => {
          toast.success(t("programSaved"))
          trackEvent.mutate({ eventType: "program_saved", payload: { template_id: template.id } })
        },
        onError: () => toast.error(t("errorGeneric")),
      },
    )
  }

  function handleStartConfirm() {
    if (!profile || !startTargetTemplate) return
    generateProgram.mutate(
      { template: startTargetTemplate, profile, activate: true },
      {
        onSuccess: () => {
          toast.success(t("programActivated"))
          setStartTargetTemplate(null)
          trackEvent.mutate({
            eventType: "program_started",
            payload: { template_id: startTargetTemplate.id },
          })
        },
        onError: () => toast.error(t("errorGeneric")),
      },
    )
  }

  if (templatesLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <LibraryFilterBar
        selectedGoal={selectedGoal}
        selectedExperience={selectedExperience}
        selectedEquipment={selectedEquipment}
        onGoalChange={setSelectedGoal}
        onExperienceChange={setSelectedExperience}
        onEquipmentChange={setEquipmentOverride}
      />

      {filteredTemplates.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noTemplates")}</p>
      )}

      <div className="grid gap-3">
        {filteredTemplates.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            isSaved={savedTemplateIds.has(tpl.id)}
            onSave={() => handleSave(tpl)}
            onStart={() => setStartTargetTemplate(tpl)}
            onDetails={() => setDetailTemplate(tpl)}
            isSaving={generateProgram.isPending}
          />
        ))}
      </div>

      <TemplateDetailSheet
        template={detailTemplate}
        open={detailTemplate !== null}
        onOpenChange={(open) => { if (!open) setDetailTemplate(null) }}
        isSaved={detailTemplate ? savedTemplateIds.has(detailTemplate.id) : false}
        onSave={() => { if (detailTemplate) handleSave(detailTemplate) }}
        onStart={() => {
          if (detailTemplate) {
            setDetailTemplate(null)
            setTimeout(() => setStartTargetTemplate(detailTemplate), 300)
          }
        }}
        isSaving={generateProgram.isPending}
      />

      <ActivateConfirmDialog
        open={startTargetTemplate !== null}
        onOpenChange={(open) => { if (!open) setStartTargetTemplate(null) }}
        onConfirm={handleStartConfirm}
        isSessionActive={session.isActive}
        isPending={generateProgram.isPending}
      />
    </div>
  )
}
