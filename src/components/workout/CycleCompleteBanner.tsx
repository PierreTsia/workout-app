import { useTranslation } from "react-i18next"
import { PartyPopper } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CycleCompleteBannerProps {
  onStartNewCycle: () => void
}

export function CycleCompleteBanner({
  onStartNewCycle,
}: CycleCompleteBannerProps) {
  const { t } = useTranslation("workout")

  return (
    <div className="mx-4 flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
      <PartyPopper className="h-5 w-5 shrink-0 text-emerald-500" />
      <div className="flex-1">
        <p className="text-sm font-medium text-emerald-200">
          {t("cycleComplete")}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20"
        onClick={onStartNewCycle}
      >
        {t("startNewCycle")}
      </Button>
    </div>
  )
}
