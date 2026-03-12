import { useAtom } from "jotai"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { installPromptStateAtom } from "@/store/atoms"
import { useInstallPrompt } from "@/hooks/useInstallPrompt"

export function InstallBanner() {
  const { t } = useTranslation()
  const [state, setState] = useAtom(installPromptStateAtom)
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()

  if (isInstalled || state.dismissed || !canInstall) return null

  function dismiss() {
    setState({ dismissed: true })
  }

  return (
    <div className="flex items-center gap-3 bg-primary/10 px-4 py-2.5 text-sm">
      <span className="flex-1">📲 {t("installBanner")}</span>
      <Button size="sm" variant="default" onClick={promptInstall}>
        {t("install")}
      </Button>
      <button
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground"
        aria-label={t("dismiss")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
