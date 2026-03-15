import { useTranslation } from "react-i18next"
import { Zap } from "lucide-react"

export function QuickWorkoutTab() {
  const { t } = useTranslation("library")

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Zap className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{t("quickWorkoutTitle")}</h2>
      <p className="max-w-xs text-sm text-muted-foreground">{t("quickWorkoutDescription")}</p>
    </div>
  )
}
