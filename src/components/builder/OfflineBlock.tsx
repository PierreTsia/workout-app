import { WifiOff } from "lucide-react"
import { useTranslation } from "react-i18next"

export function OfflineBlock() {
  const { t } = useTranslation("builder")

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="h-16 w-16 text-muted-foreground/50" />
      <h2 className="text-xl font-bold">{t("offlineTitle")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("offlineDescription")}
      </p>
    </div>
  )
}
