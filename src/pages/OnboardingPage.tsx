import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAtomValue } from "jotai"
import { Dumbbell, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { hasProgramAtom, hasProgramLoadingAtom } from "@/store/atoms"
import { useCreateUserProfile } from "@/hooks/useCreateUserProfile"
import { useGenerateProgram } from "@/hooks/useGenerateProgram"
import { useTrackEvent } from "@/hooks/useTrackEvent"
import { useOnboardingResume } from "@/hooks/useOnboardingResume"
import {
  AuthExpiredError,
  DisplayNameTakenError,
  isAuthExpiredError,
} from "@/hooks/profileErrors"
import { supabase } from "@/lib/supabase"
import { captureOnboardingError, type OnboardingRoute } from "@/lib/sentry"
import { WelcomeStep } from "@/components/onboarding/WelcomeStep"
import {
  QuestionnaireStep,
  type QuestionnaireStepError,
} from "@/components/onboarding/QuestionnaireStep"
import { PathChoiceStep } from "@/components/onboarding/PathChoiceStep"
import { TemplateRecommendationStep } from "@/components/onboarding/TemplateRecommendationStep"
import { ProgramSummaryStep } from "@/components/onboarding/ProgramSummaryStep"
import { EmbeddedAgentChatStep } from "@/components/onboarding/EmbeddedAgentChatStep"
import { EmbeddedAgentGeneratingStep } from "@/components/onboarding/EmbeddedAgentGeneratingStep"
import { EmbeddedAgentPreviewStep } from "@/components/onboarding/EmbeddedAgentPreviewStep"
import type { ProgramTemplate, UserProfile } from "@/types/onboarding"
import type { QuestionnaireOutput } from "@/components/onboarding/schema"

// T123 cutover: the legacy AI wizard (`AIGeneratingStep`/`AIProgramPreviewStep`,
// `userProfileToGenerateProgramConstraints`, the `ai_constraints/_generating/_preview`
// step names, `aiConstraints/aiResult` state) is gone from this page. The
// components themselves still live under `src/components/create-program/`
// because `CreateProgramPage` (the "create another program" surface at
// `/create-program`) still uses them. `useGenerateProgram` stays here too
// for the blank + template paths.
type WizardStep =
  | "welcome"
  | "questionnaire"
  | "path"
  | "recommendation"
  | "summary"
  | "embedded_chat"
  | "embedded_generating"
  | "embedded_preview"

// T123 analytics rename: the old `ai_*` step names mapped 1:1 onto the
// legacy AI wizard layout, which no longer exists on this page. New names
// describe the Embedded Agent stages so dashboards reflect the actual
// funnel; indices renumbered to a contiguous 4/5/6 (no more index reuse
// across paths). Funnel comparisons across the cutover date should be
// reset (see runbook).
const ANALYTICS_STEP_INDEX = {
  welcome: 1,
  questionnaire: 2,
  path: 3,
  template_recommendation: 4,
  program_summary: 5,
  embedded_agent_started: 4,
  embedded_agent_drafting: 5,
  embedded_agent_preview: 6,
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
  // #348 — surfaced as the inline alert on the questionnaire step. Set
  // on typed mutation failures so the user sees an actionable message
  // (display-name collision, generic "try again") instead of a silent
  // wizard. Cleared on next submit attempt.
  const [questionnaireError, setQuestionnaireError] =
    useState<QuestionnaireStepError | null>(null)

  const createProfile = useCreateUserProfile()
  const generateProgram = useGenerateProgram()
  const trackEvent = useTrackEvent()
  const trackedStart = useRef(false)
  const resume = useOnboardingResume()
  const resumeAppliedRef = useRef(false)

  useEffect(() => {
    if (!trackedStart.current) {
      trackedStart.current = true
      trackEvent.mutate({ eventType: "onboarding_started" })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Resume from server-persisted state on first load: skip welcome +
  // questionnaire when the user already has a profile, and jump straight
  // back into the embedded chat / preview when a thread is still active.
  // Guarded by a ref so user-driven `setStep` calls later in the session
  // don't get clobbered by a stale resume decision.
  useEffect(() => {
    if (resumeAppliedRef.current) return
    if (resume.isLoading) return
    resumeAppliedRef.current = true
    if (resume.profile) setProfileData(resume.profile)
    if (resume.initialStep !== "welcome") setStep(resume.initialStep)
  }, [resume])

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

  // #348 — auth-expired branch: tell the user, sign them out, send them
  // back to /login. Reused by every onboarding handler so the UX is the
  // same whether Supabase rejects on the questionnaire upsert or later
  // on the generate-program edge function.
  async function handleAuthExpired() {
    toast.error(t("errorAuthExpired"))
    await supabase.auth.signOut()
    navigate("/login", { replace: true })
  }

  async function handleQuestionnaireComplete(data: QuestionnaireOutput) {
    setQuestionnaireError(null)
    try {
      await createProfile.mutateAsync(data)
    } catch (e) {
      captureOnboardingError("/questionnaire", e)
      if (e instanceof AuthExpiredError) {
        await handleAuthExpired()
        return
      }
      if (e instanceof DisplayNameTakenError) {
        setQuestionnaireError({
          title: t("questionnaireErrorDisplayNameTakenTitle"),
          body: t("questionnaireErrorDisplayNameTakenBody"),
        })
        return
      }
      setQuestionnaireError({
        title: t("questionnaireErrorTitle"),
        body: t("questionnaireErrorBody"),
      })
      return
    }
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
      timezone: getResolvedIANATimeZone(),
      created_at: "",
      updated_at: "",
    }
    setProfileData(profile)
    setStep("path")
  }

  // #348 — generic safety net for the post-questionnaire mutations
  // (`generateProgram.mutateAsync` from blank/template/AI-fallback
  // paths). These don't have an inline error UI like the questionnaire
  // — the user has already moved past `<QuestionnaireStep>` — so we
  // surface failures via `toast.error` and keep the wizard on the
  // current step so they can retry. The Sentry tag still differentiates
  // by `route` so the dashboard can pinpoint which path is bleeding.
  function handleProgramGenerationError(route: OnboardingRoute, e: unknown) {
    captureOnboardingError(route, e)
    if (isAuthExpiredError(e)) {
      void handleAuthExpired()
      return
    }
    toast.error(t("errorGenericProgram"))
  }

  async function completeBlankProgramAndGoToBuilder(
    programPath: "self_directed" | "guided",
    route: OnboardingRoute,
  ) {
    if (!profileData) return
    try {
      const programId = await generateProgram.mutateAsync({
        template: null,
        profile: profileData,
      })
      trackEvent.mutate({
        eventType: "program_created",
        payload: { program_id: programId, template_id: null, path: programPath },
      })
      navigate(`/builder/${programId}`, { replace: true, state: { from: "/onboarding" } })
    } catch (e) {
      handleProgramGenerationError(route, e)
    }
  }

  async function handleSelfDirected() {
    if (!profileData) return
    trackStepCompleted("path")
    await completeBlankProgramAndGoToBuilder("self_directed", "/path")
  }

  async function handleSkipTemplate() {
    if (!profileData) return
    trackEvent.mutate({
      eventType: "onboarding_skipped",
      payload: { from_step: 4 },
    })
    await completeBlankProgramAndGoToBuilder("guided", "/template")
  }

  async function handleAIFallbackBlank() {
    if (!profileData) return
    try {
      const programId = await generateProgram.mutateAsync({
        template: null,
        profile: profileData,
      })
      trackEvent.mutate({
        eventType: "program_created",
        payload: { program_id: programId, template_id: null, path: "self_directed" },
      })
      navigate(`/builder/${programId}`, { replace: true, state: { from: "/onboarding" } })
    } catch (e) {
      handleProgramGenerationError("/ai_fallback", e)
    }
  }

  async function handleConfirmProgram() {
    if (!profileData || !selectedTemplate) return
    trackStepCompleted("program_summary")
    try {
      const programId = await generateProgram.mutateAsync({
        template: selectedTemplate,
        profile: profileData,
      })
      trackEvent.mutate({
        eventType: "program_created",
        payload: { program_id: programId, template_id: selectedTemplate.id, path: "guided" },
      })
      navigate("/", { replace: true })
    } catch (e) {
      handleProgramGenerationError("/summary", e)
    }
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

  // Hold the wizard back until the resume probe resolves. Without this we
  // flash "welcome" for a frame before snapping to the resumed step, which
  // is jarring on a fast network and causes the analytics step counter to
  // double-fire.
  if (resume.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  // The chat step needs noticeably more horizontal real estate than the
  // questionnaire / template / preview steps — bumped to 3xl so the
  // assistant's longer, markdown-rich replies actually breathe.
  const containerWidth =
    step === "embedded_chat" || step === "embedded_preview" ? "max-w-3xl" : "max-w-lg"

  // The chat + preview steps lock their layout to viewport height so the
  // transcript / preview list scrolls *inside* the card instead of the
  // whole page. Other steps keep min-h-dvh so they grow naturally with
  // their content.
  const isLockedHeightStep = step === "embedded_chat" || step === "embedded_preview"
  const outerHeight = isLockedHeightStep ? "h-dvh overflow-hidden" : "min-h-dvh"
  const innerMinHeight = isLockedHeightStep ? "min-h-0" : ""

  return (
    <div className={`flex ${outerHeight} flex-col items-center`}>
      <div className={`flex w-full ${containerWidth} flex-1 flex-col ${innerMinHeight}`}>
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
          <QuestionnaireStep
            onNext={handleQuestionnaireComplete}
            error={questionnaireError}
          />
        )}

        {step === "path" && (
          <PathChoiceStep
            onAI={() => {
              if (!profileData) return
              trackStepCompleted("path")
              // T123 cutover: AI path always lands the user in the
              // Embedded Agent chat. We fire `embedded_agent_started`
              // here (transition out of /path) — same boundary the
              // legacy flow fired `ai_constraints` from. Keeps the
              // funnel comparable across the cutover and captures
              // users whose /thread call later fails as drop-offs at
              // the chat step rather than missing this event entirely.
              trackStepCompleted("embedded_agent_started", { source: "questionnaire_profile" })
              setStep("embedded_chat")
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

        {step === "embedded_chat" && (
          <EmbeddedAgentChatStep
            locale={i18n.language === "fr" ? "fr" : "en"}
            onBack={() => setStep("path")}
            onPreviewReady={() => {
              // Resumed-into-preview path (user closed the tab on the
              // preview screen and came back). The funnel still needs
              // to see the preview event so the soak / commit ratio
              // matches reality.
              trackStepCompleted("embedded_agent_preview", { source: "resumed_thread" })
              setStep("embedded_preview")
            }}
            onGenerateRequest={() => {
              trackStepCompleted("embedded_agent_drafting")
              setStep("embedded_generating")
            }}
          />
        )}

        {step === "embedded_generating" && (
          <EmbeddedAgentGeneratingStep
            locale={i18n.language === "fr" ? "fr" : "en"}
            onSuccess={() => {
              trackStepCompleted("embedded_agent_preview", { source: "fresh_draft" })
              setStep("embedded_preview")
            }}
            onFallbackTemplate={() => setStep("recommendation")}
            onFallbackBlank={handleAIFallbackBlank}
          />
        )}

        {step === "embedded_preview" && (
          <EmbeddedAgentPreviewStep
            locale={i18n.language === "fr" ? "fr" : "en"}
            onRegenerate={() => setStep("embedded_chat")}
            onCommitted={(programId) => {
              trackEvent.mutate({
                eventType: "program_created",
                payload: { program_id: programId, template_id: null, path: "ai" },
              })
              navigate("/", { replace: true })
            }}
            onFallbackTemplate={() => setStep("recommendation")}
            onFallbackBlank={handleAIFallbackBlank}
          />
        )}
      </div>
    </div>
  )
}
