import { Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"

interface CoachRationaleProps {
  rationale: string
}

export function CoachRationale({ rationale }: CoachRationaleProps) {
  const { t } = useTranslation("create-program")

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        {t("coachSays")}
      </div>
      <p className="text-sm leading-relaxed text-foreground">{rationale}</p>
    </div>
  )
}
