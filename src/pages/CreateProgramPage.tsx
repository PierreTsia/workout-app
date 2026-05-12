import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Dumbbell } from "lucide-react"
import { PathChoiceStep } from "@/components/create-program/PathChoiceStep"
import { BlankProgramStep } from "@/components/create-program/BlankProgramStep"
import { EmbeddedAgentChatStep } from "@/components/embedded-agent/EmbeddedAgentChatStep"
import { EmbeddedAgentGeneratingStep } from "@/components/embedded-agent/EmbeddedAgentGeneratingStep"
import { EmbeddedAgentPreviewStep } from "@/components/embedded-agent/EmbeddedAgentPreviewStep"
import { TemplateChoiceStep } from "@/components/create-program/TemplateChoiceStep"

// T136 (#343) — replaced the legacy AI branch (`ai-constraints` →
// `ai-generating` → `ai-preview` driven by `useAIGenerateProgram` /
// `AIConstraintStep` / `AIProgramPreviewStep`) with the Embedded Agent
// chat flow consuming `purpose='additional_program'`. The wizard now
// has one less step (no constraints form; the model elicits them in
// chat) and the thread `.status` drives chat ↔ preview transitions.
// `ai-generating` stays as a transient UI state during the `/draft`
// mutation — not a thread status.
type WizardStep =
  | "path-choice"
  | "ai-chat"
  | "ai-generating"
  | "ai-preview"
  | "template-choice"
  | "template-preview"
  | "blank"

export function CreateProgramPage() {
  const { t, i18n } = useTranslation("create-program")
  const navigate = useNavigate()

  const [step, setStep] = useState<WizardStep>("path-choice")

  function handlePathSelect(selected: "ai" | "template" | "blank") {
    switch (selected) {
      case "ai":
        setStep("ai-chat")
        break
      case "template":
        setStep("template-choice")
        break
      case "blank":
        setStep("blank")
        break
    }
  }

  function handleBack() {
    switch (step) {
      case "path-choice":
        navigate("/library/programs")
        return
      case "ai-chat":
        setStep("path-choice")
        return
      case "ai-generating":
        // Mid-draft back is purely navigational; the /draft mutation
        // either resolved into preview_ready (next step takes over) or
        // surfaced an error inline. Returning to chat lets the user
        // pick up the same thread without re-eliciting motivation.
        setStep("ai-chat")
        return
      case "ai-preview":
        setStep("ai-chat")
        return
      case "template-choice":
        setStep("path-choice")
        return
      case "template-preview":
        setStep("template-choice")
        return
      case "blank":
        setStep("path-choice")
        return
    }
  }

  const locale: "en" | "fr" = i18n.language === "fr" ? "fr" : "en"

  return (
    <div className="flex min-h-dvh flex-col items-center">
      <div className="flex w-full max-w-lg flex-1 flex-col">
        <header className="flex items-center gap-3 px-6 py-4">
          <button
            onClick={handleBack}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Dumbbell className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">{t("title")}</span>
        </header>

        {step === "path-choice" && (
          <PathChoiceStep onSelect={handlePathSelect} />
        )}

        {step === "blank" && <BlankProgramStep />}

        {step === "ai-chat" && (
          <EmbeddedAgentChatStep
            locale={locale}
            purpose="additional_program"
            i18nNamespace="create-program"
            onBack={() => setStep("path-choice")}
            onGenerateRequest={() => setStep("ai-generating")}
            onPreviewReady={() => setStep("ai-preview")}
          />
        )}

        {step === "ai-generating" && (
          <EmbeddedAgentGeneratingStep
            locale={locale}
            purpose="additional_program"
            i18nNamespace="create-program"
            onSuccess={() => setStep("ai-preview")}
            onFallbackTemplate={() => setStep("template-choice")}
            onFallbackBlank={() => setStep("blank")}
          />
        )}

        {step === "ai-preview" && (
          <EmbeddedAgentPreviewStep
            locale={locale}
            purpose="additional_program"
            i18nNamespace="create-program"
            onRegenerate={() => setStep("ai-chat")}
            onCommitted={() => navigate("/library/programs")}
            onFallbackTemplate={() => setStep("template-choice")}
            onFallbackBlank={() => setStep("blank")}
          />
        )}

        {step === "template-choice" && <TemplateChoiceStep />}
      </div>
    </div>
  )
}
