import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAtomValue } from "jotai"
import { Dumbbell, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { userProfileToGenerateProgramConstraints } from "@/lib/userProfileToGenerateProgramConstraints"
import { hasProgramAtom, hasProgramLoadingAtom } from "@/store/atoms"
import { useCreateUserProfile } from "@/hooks/useCreateUserProfile"
import { useGenerateProgram } from "@/hooks/useGenerateProgram"
import { useTrackEvent } from "@/hooks/useTrackEvent"
import { WelcomeStep } from "@/components/onboarding/WelcomeStep"
import { QuestionnaireStep } from "@/components/onboarding/QuestionnaireStep"
import { PathChoiceStep } from "@/components/onboarding/PathChoiceStep"
import { TemplateRecommendationStep } from "@/components/onboarding/TemplateRecommendationStep"
import { ProgramSummaryStep } from "@/components/onboarding/ProgramSummaryStep"
import { AIGeneratingStep } from "@/components/create-program/AIGeneratingStep"
import { AIProgramPreviewStep } from "@/components/create-program/AIProgramPreviewStep"
import type { ProgramTemplate, UserProfile } from "@/types/onboarding"
import type { QuestionnaireOutput } from "@/components/onboarding/schema"
import type { AIGeneratedProgram, GenerateProgramConstraints } from "@/types/aiProgram"

type WizardStep =
  | "welcome"
  | "questionnaire"
  | "path"
  | "recommendation"
  | "summary"
  | "ai_generating"
  | "ai_preview"

const ANALYTICS_STEP_INDEX = {
  welcome: 1,
  questionnaire: 2,
  path: 3,
  template_recommendation: 4,
  program_summary: 5,
  ai_constraints: 4,
  ai_generating: 5,
  ai_preview: 6,
} as const

type AnalyticsStepName = keyof typeof ANALYTICS_STEP_INDEX

export function OnboardingPage() {
  const { t, i18n } = useTranslation("onboarding")
  const hasProgram = useAtomValue(hasProgramAtom)
  const hasProgramLoading = useAtomValue(hasProgramLoadingAtom)
  const navigate = useNavigate()

  const [step, setStep] = useState<WizardStep>("welcome")
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ProgramTemplate | null>(null)
  const [aiConstraints, setAiConstraints] = useState<GenerateProgramConstraints | null>(null)
  const [aiResult, setAiResult] = useState<AIGeneratedProgram | null>(null)

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

  // Do not redirect on every `hasProgram` render: blank/skip flows set hasProgram before
  // `navigate("/builder/...")` runs after `await mutateAsync`, and `<Navigate to="/" />`
  // would win and strand users on home. Only bounce users who already have a program
  // but landed on early wizard steps (bookmark, refresh, duplicate tab).
  useEffect(() => {
    if (hasProgramLoading) return
    if (!hasProgram) return
    if (step === "welcome" || step === "questionnaire") {
      navigate("/", { replace: true })
    }
  }, [hasProgram, hasProgramLoading, step, navigate])

  function trackStepCompleted(name: AnalyticsStepName, extra?: Record<string, unknown>) {
    trackEvent.mutate({
      eventType: "onboarding_step_completed",
      payload: { step: ANALYTICS_STEP_INDEX[name], step_name: name, ...extra },
    })
  }

  const isGenerating = generateProgram.isPending

  async function handleQuestionnaireComplete(data: QuestionnaireOutput) {
    await createProfile.mutateAsync(data)
    trackStepCompleted("questionnaire")

    const profile: UserProfile = {
      user_id: "",
      display_name: null,
      avatar_url: null,
      gender: data.gender,
      age: data.age,
      weight_kg: data.weight,
      goal: data.goal,
      experience: data.experience,
      equipment: data.equipment,
      training_days_per_week: data.training_days_per_week,
      session_duration_minutes: data.session_duration_minutes,
      active_title_tier_id: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      created_at: "",
      updated_at: "",
    }
    setProfileData(profile)
    setStep("path")
  }

  async function completeBlankProgramAndGoToBuilder(programPath: "self_directed" | "guided") {
    if (!profileData) return
    const programId = await generateProgram.mutateAsync({ template: null, profile: profileData })
    trackEvent.mutate({
      eventType: "program_created",
      payload: { program_id: programId, template_id: null, path: programPath },
    })
    navigate(`/builder/${programId}`, { replace: true, state: { from: "/onboarding" } })
  }

  async function handleSelfDirected() {
    if (!profileData) return
    trackStepCompleted("path")
    await completeBlankProgramAndGoToBuilder("self_directed")
  }

  async function handleSkipTemplate() {
    if (!profileData) return
    trackEvent.mutate({
      eventType: "onboarding_skipped",
      payload: { from_step: 4 },
    })
    await completeBlankProgramAndGoToBuilder("guided")
  }

  async function handleAIFallbackBlank() {
    if (!profileData) return
    const programId = await generateProgram.mutateAsync({ template: null, profile: profileData })
    trackEvent.mutate({
      eventType: "program_created",
      payload: { program_id: programId, template_id: null, path: "self_directed" },
    })
    navigate(`/builder/${programId}`, { replace: true, state: { from: "/onboarding" } })
  }

  async function handleConfirmProgram() {
    if (!profileData || !selectedTemplate) return
    trackStepCompleted("program_summary")
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

  function handleAISuccess(result: AIGeneratedProgram) {
    trackStepCompleted("ai_generating")
    setAiResult(result)
    setStep("ai_preview")
  }

  function handleAIProgramCreated(programId: string) {
    trackStepCompleted("ai_preview")
    trackEvent.mutate({
      eventType: "program_created",
      payload: { program_id: programId, template_id: null, path: "ai" },
    })
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
            onAI={() => {
              if (!profileData) return
              trackStepCompleted("path")
              setAiResult(null)
              const constraints = userProfileToGenerateProgramConstraints(profileData, i18n.language)
              setAiConstraints(constraints)
              trackStepCompleted("ai_constraints", { source: "questionnaire_profile" })
              setStep("ai_generating")
            }}
            onTemplate={() => {
              trackStepCompleted("path")
              setStep("recommendation")
            }}
            onBlank={handleSelfDirected}
          />
        )}

        {step === "recommendation" && profileData && (
          <TemplateRecommendationStep
            profile={profileData}
            onSelect={(tpl) => {
              trackStepCompleted("template_recommendation")
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

        {step === "ai_generating" && aiConstraints && (
          <AIGeneratingStep
            constraints={aiConstraints}
            onSuccess={handleAISuccess}
            onFallbackTemplate={() => setStep("recommendation")}
            onFallbackBlank={handleAIFallbackBlank}
          />
        )}

        {step === "ai_preview" && aiResult && aiConstraints && (
          <AIProgramPreviewStep
            program={aiResult}
            constraints={aiConstraints}
            onRegenerate={() => setStep("ai_generating")}
            successReplacePath="/"
            onProgramCreated={handleAIProgramCreated}
          />
        )}
      </div>
    </div>
  )
}
