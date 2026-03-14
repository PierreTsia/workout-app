import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useAtomValue } from "jotai"
import { Dumbbell, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { hasProgramAtom } from "@/store/atoms"
import { useCreateUserProfile } from "@/hooks/useCreateUserProfile"
import { useGenerateProgram } from "@/hooks/useGenerateProgram"
import { WelcomeStep } from "@/components/onboarding/WelcomeStep"
import { QuestionnaireStep } from "@/components/onboarding/QuestionnaireStep"
import { PathChoiceStep } from "@/components/onboarding/PathChoiceStep"
import { TemplateRecommendationStep } from "@/components/onboarding/TemplateRecommendationStep"
import { ProgramSummaryStep } from "@/components/onboarding/ProgramSummaryStep"
import type { ProgramTemplate, UserProfile } from "@/types/onboarding"
import type { QuestionnaireOutput } from "@/components/onboarding/schema"

type Step = "welcome" | "questionnaire" | "path" | "recommendation" | "summary"

export function OnboardingPage() {
  const { t } = useTranslation("onboarding")
  const hasProgram = useAtomValue(hasProgramAtom)
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>("welcome")
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ProgramTemplate | null>(null)

  const createProfile = useCreateUserProfile()
  const generateProgram = useGenerateProgram()

  if (hasProgram) return <Navigate to="/" replace />

  const isGenerating = generateProgram.isPending

  async function handleQuestionnaireComplete(data: QuestionnaireOutput) {
    await createProfile.mutateAsync(data)

    const profile: UserProfile = {
      user_id: "",
      gender: data.gender,
      age: data.age,
      weight_kg: data.weight,
      goal: data.goal,
      experience: data.experience,
      equipment: data.equipment,
      training_days_per_week: data.training_days_per_week,
      session_duration_minutes: data.session_duration_minutes,
      created_at: "",
      updated_at: "",
    }
    setProfileData(profile)
    setStep("path")
  }

  async function handleSelfDirected() {
    if (!profileData) return
    await generateProgram.mutateAsync({ template: null, profile: profileData })
    navigate("/builder", { replace: true })
  }

  async function handleSkipTemplate() {
    if (!profileData) return
    await generateProgram.mutateAsync({ template: null, profile: profileData })
    navigate("/builder", { replace: true })
  }

  async function handleConfirmProgram() {
    if (!profileData || !selectedTemplate) return
    await generateProgram.mutateAsync({ template: selectedTemplate, profile: profileData })
    navigate("/", { replace: true })
  }

  if (isGenerating) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("generating")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center">
      <div className="flex w-full max-w-lg flex-1 flex-col">
        <header className="flex items-center gap-2 px-6 py-4">
          <Dumbbell className="h-6 w-6 text-primary" />
        </header>

        {step === "welcome" && <WelcomeStep onNext={() => setStep("questionnaire")} />}

        {step === "questionnaire" && (
          <QuestionnaireStep onNext={handleQuestionnaireComplete} />
        )}

        {step === "path" && (
          <PathChoiceStep
            onGuided={() => setStep("recommendation")}
            onSelfDirected={handleSelfDirected}
          />
        )}

        {step === "recommendation" && profileData && (
          <TemplateRecommendationStep
            profile={profileData}
            onSelect={(tpl) => {
              setSelectedTemplate(tpl)
              setStep("summary")
            }}
            onSkip={handleSkipTemplate}
          />
        )}

        {step === "summary" && profileData && selectedTemplate && (
          <ProgramSummaryStep
            template={selectedTemplate}
            profile={profileData}
            onConfirm={handleConfirmProgram}
            onBack={() => setStep("recommendation")}
          />
        )}
      </div>
    </div>
  )
}
