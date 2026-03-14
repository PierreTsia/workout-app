import { useEffect, useRef, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useAtomValue } from "jotai"
import { Dumbbell, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { hasProgramAtom } from "@/store/atoms"
import { useCreateUserProfile } from "@/hooks/useCreateUserProfile"
import { useGenerateProgram } from "@/hooks/useGenerateProgram"
import { useTrackEvent } from "@/hooks/useTrackEvent"
import { WelcomeStep } from "@/components/onboarding/WelcomeStep"
import { QuestionnaireStep } from "@/components/onboarding/QuestionnaireStep"
import { PathChoiceStep } from "@/components/onboarding/PathChoiceStep"
import { TemplateRecommendationStep } from "@/components/onboarding/TemplateRecommendationStep"
import { ProgramSummaryStep } from "@/components/onboarding/ProgramSummaryStep"
import type { ProgramTemplate, UserProfile } from "@/types/onboarding"
import type { QuestionnaireOutput } from "@/components/onboarding/schema"

type Step = "welcome" | "questionnaire" | "path" | "recommendation" | "summary"

const STEP_NAMES: Record<Step, string> = {
  welcome: "welcome",
  questionnaire: "questionnaire",
  path: "path_choice",
  recommendation: "template_recommendation",
  summary: "program_summary",
}

export function OnboardingPage() {
  const { t } = useTranslation("onboarding")
  const hasProgram = useAtomValue(hasProgramAtom)
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>("welcome")
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ProgramTemplate | null>(null)

  const createProfile = useCreateUserProfile()
  const generateProgram = useGenerateProgram()
  const trackEvent = useTrackEvent()
  const trackedStart = useRef(false)

  useEffect(() => {
    if (!trackedStart.current) {
      trackedStart.current = true
      trackEvent.mutate({ eventType: "onboarding_started" })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function trackStepCompleted(stepKey: Step) {
    const stepIndex = Object.keys(STEP_NAMES).indexOf(stepKey) + 1
    trackEvent.mutate({
      eventType: "onboarding_step_completed",
      payload: { step: stepIndex, step_name: STEP_NAMES[stepKey] },
    })
  }

  if (hasProgram) return <Navigate to="/" replace />

  const isGenerating = generateProgram.isPending

  async function handleQuestionnaireComplete(data: QuestionnaireOutput) {
    await createProfile.mutateAsync(data)
    trackStepCompleted("questionnaire")

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
    trackStepCompleted("path")
    const programId = await generateProgram.mutateAsync({ template: null, profile: profileData })
    trackEvent.mutate({
      eventType: "program_created",
      payload: { program_id: programId, template_id: null, path: "self_directed" },
    })
    navigate("/builder", { replace: true })
  }

  async function handleSkipTemplate() {
    if (!profileData) return
    trackEvent.mutate({
      eventType: "onboarding_skipped",
      payload: { from_step: 4 },
    })
    const programId = await generateProgram.mutateAsync({ template: null, profile: profileData })
    trackEvent.mutate({
      eventType: "program_created",
      payload: { program_id: programId, template_id: null, path: "guided" },
    })
    navigate("/builder", { replace: true })
  }

  async function handleConfirmProgram() {
    if (!profileData || !selectedTemplate) return
    trackStepCompleted("summary")
    const programId = await generateProgram.mutateAsync({
      template: selectedTemplate,
      profile: profileData,
    })
    trackEvent.mutate({
      eventType: "program_created",
      payload: { program_id: programId, template_id: selectedTemplate.id, path: "guided" },
    })
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

        {step === "welcome" && (
          <WelcomeStep
            onNext={() => {
              trackStepCompleted("welcome")
              setStep("questionnaire")
            }}
          />
        )}

        {step === "questionnaire" && (
          <QuestionnaireStep onNext={handleQuestionnaireComplete} />
        )}

        {step === "path" && (
          <PathChoiceStep
            onGuided={() => {
              trackStepCompleted("path")
              setStep("recommendation")
            }}
            onSelfDirected={handleSelfDirected}
          />
        )}

        {step === "recommendation" && profileData && (
          <TemplateRecommendationStep
            profile={profileData}
            onSelect={(tpl) => {
              trackStepCompleted("recommendation")
              trackEvent.mutate({
                eventType: "template_selected",
                payload: { template_id: tpl.id, template_name: tpl.name },
              })
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
