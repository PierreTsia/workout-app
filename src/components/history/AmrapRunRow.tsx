import { useTranslation } from "react-i18next"
import { Trophy, TrendingDown, TrendingUp } from "lucide-react"
import { AmrapScore } from "@/components/circuit/AmrapScore"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import { cn } from "@/lib/utils"
import type { AmrapRunView } from "@/lib/amrapScore"

function AmrapDeltaChip({ rounds }: { rounds: number }) {
  const { t } = useTranslation("history")
  const improved = rounds > 0
  const Icon = improved ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
        improved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {improved ? "+" : "−"}
      {t("circuit.roundsDelta", { count: Math.abs(rounds) })}
      <span className="font-normal text-muted-foreground"> {t("circuit.vsPrevious")}</span>
    </span>
  )
}

export function AmrapRunRow({ view }: { view: AmrapRunView }) {
  const { t, i18n } = useTranslation("history")
  const when = formatRelativeTime(view.date, i18n.language)

  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{when}</p>
        {view.shapeChanged && (
          <p className="text-[11px] text-muted-foreground">{t("circuit.shapeChanged")}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {view.score != null ? (
          <div className="flex items-center gap-2">
            {view.isPb && (
              <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                <Trophy className="h-3 w-3" aria-hidden />
                {t("circuit.pb")}
              </span>
            )}
            <AmrapScore
              size="compact"
              fullRounds={view.score.fullRounds}
              leftover={view.score.leftover}
              leftoverName={view.score.leftoverName}
            />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t("circuit.incompleteRun")}</span>
        )}
        {view.score != null && view.deltaRounds != null && (
          <AmrapDeltaChip rounds={view.deltaRounds} />
        )}
      </div>
    </li>
  )
}
