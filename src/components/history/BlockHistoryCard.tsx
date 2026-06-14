import { useTranslation } from "react-i18next"
import { Layers } from "lucide-react"
import { formatSecondsMMSS } from "@/lib/formatters"
import type { BlockHistoryGroup } from "@/lib/sessionHistoryGrouping"

/**
 * A completed circuit (Exercise Block) in session history: one grouped card with
 * the circuit label, its round count, and per-round actuals for each exercise —
 * instead of flattening the block into disconnected solo lines (#351, T143).
 */
export function BlockHistoryCard({
  group,
  formatWeight,
}: {
  group: BlockHistoryGroup
  formatWeight: (kg: number) => string
}) {
  const { t } = useTranslation("history")

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5 text-primary" aria-hidden />
        <p className="text-xs font-semibold text-foreground">
          {group.label ?? t("circuit.fallbackLabel")}
        </p>
        <span className="text-[10px] text-muted-foreground">
          · {t("circuit.rounds", { count: group.rounds.length })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {group.rounds.map((round) => (
          <div key={round.round}>
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("circuit.round", { n: round.round })}
            </p>
            <div className="flex flex-col gap-0.5">
              {round.cells.map((cell) => (
                <div
                  key={cell.blockExerciseId}
                  className="flex items-center gap-2 text-xs"
                >
                  <span aria-hidden>{cell.emoji}</span>
                  <span className="flex-1 truncate">{cell.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {cell.log.duration_seconds != null
                      ? formatSecondsMMSS(cell.log.duration_seconds)
                      : (cell.log.reps_logged ?? "–")}
                  </span>
                  <span className="tabular-nums">
                    {formatWeight(Number(cell.log.weight_logged))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
