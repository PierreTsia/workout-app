import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Dumbbell } from "lucide-react"
import { PathChoiceStep } from "@/components/create-program/PathChoiceStep"
import { BlankProgramStep } from "@/components/create-program/BlankProgramStep"

type WizardPath = "ai" | "template" | "blank" | null
type WizardStep = "path-choice" | "ai-constraints" | "ai-generating" | "ai-preview" | "template-choice" | "template-preview" | "blank"

export function CreateProgramPage() {
  const { t } = useTranslation("create-program")
  const navigate = useNavigate()

  const [path, setPath] = useState<WizardPath>(null)
  const [step, setStep] = useState<WizardStep>("path-choice")

  function handlePathSelect(selected: "ai" | "template" | "blank") {
    setPath(selected)
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

  function handleBack() {
    if (step === "path-choice") {
      navigate("/library")
      return
    }
    setPath(null)
    setStep("path-choice")
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
          <div className="flex flex-1 items-center justify-center px-6 text-muted-foreground">
            AI Constraint Step (T45)
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
