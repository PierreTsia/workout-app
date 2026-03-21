import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Dumbbell } from "lucide-react"
import { PathChoiceStep } from "@/components/create-program/PathChoiceStep"
import { BlankProgramStep } from "@/components/create-program/BlankProgramStep"
import { AIConstraintStep } from "@/components/create-program/AIConstraintStep"
import { AIGeneratingStep } from "@/components/create-program/AIGeneratingStep"
import type { GenerateProgramConstraints, AIGeneratedProgram } from "@/types/aiProgram"

type WizardStep =
  | "path-choice"
  | "ai-constraints"
  | "ai-generating"
  | "ai-preview"
  | "template-choice"
  | "template-preview"
  | "blank"

export function CreateProgramPage() {
  const { t } = useTranslation("create-program")
  const navigate = useNavigate()

  const [step, setStep] = useState<WizardStep>("path-choice")
  const [constraints, setConstraints] = useState<GenerateProgramConstraints | null>(null)
  const [aiResult, setAiResult] = useState<AIGeneratedProgram | null>(null)

  function handlePathSelect(selected: "ai" | "template" | "blank") {
    switch (selected) {
      case "ai":
        setStep("ai-constraints")
        break
      case "template":
        setStep("template-choice")
        break
      case "blank":
        setStep("blank")
        break
    }
  }

  function handleConstraintsSubmit(c: GenerateProgramConstraints) {
    setConstraints(c)
    setStep("ai-generating")
  }

  function handleAISuccess(result: AIGeneratedProgram) {
    setAiResult(result)
    setStep("ai-preview")
  }

  function handleBack() {
    switch (step) {
      case "path-choice":
        navigate("/library")
        return
      case "ai-constraints":
        setStep("path-choice")
        return
      case "ai-generating":
        setStep("ai-constraints")
        return
      case "ai-preview":
        setStep("ai-constraints")
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

        {step === "ai-constraints" && (
          <AIConstraintStep onSubmit={handleConstraintsSubmit} />
        )}

        {step === "ai-generating" && constraints && (
          <AIGeneratingStep
            constraints={constraints}
            onSuccess={handleAISuccess}
            onFallbackTemplate={() => setStep("template-choice")}
            onFallbackBlank={() => setStep("blank")}
          />
        )}

        {step === "ai-preview" && aiResult && (
          <div className="flex flex-1 items-center justify-center px-6 text-muted-foreground">
            AI Preview Step (T46)
          </div>
        )}

        {step === "template-choice" && (
          <div className="flex flex-1 items-center justify-center px-6 text-muted-foreground">
            Template Choice Step (T47)
          </div>
        )}
      </div>
    </div>
  )
}
