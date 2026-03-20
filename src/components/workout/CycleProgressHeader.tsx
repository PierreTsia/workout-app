import { useTranslation } from "react-i18next"
import { RotateCw } from "lucide-react"

interface CycleProgressHeaderProps {
  completedCount: number
  totalDays: number
}

export function CycleProgressHeader({
  completedCount,
  totalDays,
}: CycleProgressHeaderProps) {
  const { t } = useTranslation("workout")

  if (totalDays === 0) return null

  const pct = Math.round((completedCount / totalDays) * 100)

  return (
    <div className="mx-4 flex items-center gap-3">
      <RotateCw className="h-4 w-4 shrink-0 text-primary" />
      <div className="flex-1">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="font-medium text-foreground">
            {t("cycleProgress", { current: completedCount, total: totalDays })}
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
