import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAtomValue } from "jotai"
import { useQuery } from "@tanstack/react-query"
import { Loader2, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { authAtom, activeProgramIdAtom } from "@/store/atoms"
import { supabase } from "@/lib/supabase"
import { useGenerateProgram } from "@/hooks/useGenerateProgram"
import { useTrackEvent } from "@/hooks/useTrackEvent"
import { PathChoiceStep } from "@/components/onboarding/PathChoiceStep"
import { TemplateRecommendationStep } from "@/components/onboarding/TemplateRecommendationStep"
import { ProgramSummaryStep } from "@/components/onboarding/ProgramSummaryStep"
import type { ProgramTemplate, UserProfile } from "@/types/onboarding"

type Step = "path" | "recommendation" | "summary"

export function ChangeProgramPage() {
  const { t } = useTranslation("onboarding")
  const navigate = useNavigate()
  const user = useAtomValue(authAtom)
  const oldProgramId = useAtomValue(activeProgramIdAtom)

  const [step, setStep] = useState<Step>("path")
  const [selectedTemplate, setSelectedTemplate] = useState<ProgramTemplate | null>(null)

  const generateProgram = useGenerateProgram()
  const trackEvent = useTrackEvent()

  const { data: profile, isLoading: profileLoading } = useQuery({
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

  if (profileLoading || !profile) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (generateProgram.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("switchingProgram")}</p>
        </div>
      </div>
    )
  }

  async function handleSelfDirected() {
    if (!profile) return
    const newProgramId = await generateProgram.mutateAsync({ template: null, profile })
    trackEvent.mutate({
      eventType: "program_changed",
      payload: { old_program_id: oldProgramId, new_program_id: newProgramId, template_id: null },
    })
    navigate("/builder", { replace: true })
  }

  async function handleSkipTemplate() {
    if (!profile) return
    const newProgramId = await generateProgram.mutateAsync({ template: null, profile })
    trackEvent.mutate({
      eventType: "program_changed",
      payload: { old_program_id: oldProgramId, new_program_id: newProgramId, template_id: null },
    })
    navigate("/builder", { replace: true })
  }

  async function handleConfirmProgram() {
    if (!profile || !selectedTemplate) return
    const newProgramId = await generateProgram.mutateAsync({
      template: selectedTemplate,
      profile,
    })
    trackEvent.mutate({
      eventType: "program_changed",
      payload: {
        old_program_id: oldProgramId,
        new_program_id: newProgramId,
        template_id: selectedTemplate.id,
      },
    })
    navigate("/", { replace: true })
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="flex w-full max-w-lg flex-1 flex-col">
        <header className="flex items-center gap-2 px-6 py-4">
          <RefreshCw className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">{t("changeProgramTitle")}</h1>
            <p className="text-xs text-muted-foreground">{t("changeProgramDescription")}</p>
          </div>
        </header>

        {step === "path" && (
          <PathChoiceStep
            onGuided={() => setStep("recommendation")}
            onSelfDirected={handleSelfDirected}
          />
        )}

        {step === "recommendation" && (
          <TemplateRecommendationStep
            profile={profile}
            onSelect={(tpl) => {
              setSelectedTemplate(tpl)
              setStep("summary")
            }}
            onSkip={handleSkipTemplate}
          />
        )}

        {step === "summary" && selectedTemplate && (
          <ProgramSummaryStep
            template={selectedTemplate}
            profile={profile}
            onConfirm={handleConfirmProgram}
            onBack={() => setStep("recommendation")}
          />
        )}
      </div>
    </div>
  )
}
