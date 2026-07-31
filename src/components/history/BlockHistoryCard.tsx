import { useTranslation } from "react-i18next"
import { Layers, Timer } from "lucide-react"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { formatSecondsMMSS } from "@/lib/formatters"
import {
  isRunComplete,
  runCompletionSeconds,
  type BlockRunCellRow,
} from "@/lib/blockCompletionHistory"
import type { BlockHistoryGroup } from "@/lib/sessionHistoryGrouping"

/** Flatten a history group's cells into the row shape the completion-time lib expects. */
function groupCells(group: BlockHistoryGroup): BlockRunCellRow[] {
  return group.rounds.flatMap((round) =>
    round.cells.map((cell) => ({
      session_id: cell.log.session_id,
      block_exercise_id: cell.blockExerciseId,
      set_number: cell.log.set_number,
      reps_logged: cell.log.reps_logged,
      duration_seconds: cell.log.duration_seconds,
      weight_logged: Number(cell.log.weight_logged),
      logged_at: cell.log.logged_at,
    })),
  )
}

/**
 * A completed circuit (Exercise Block) in session history: one grouped card with
 * the circuit label, its round count, per-round actuals, and — for a complete
 * run — its derived completion time (#396). Tapping the card opens the circuit's
 * history sheet via `onOpen`.
 */
export function BlockHistoryCard({
  group,
  formatWeight,
  onOpen,
}: {
  group: BlockHistoryGroup
  formatWeight: (kg: number) => string
  onOpen?: (group: BlockHistoryGroup) => void
}) {
  const { t } = useTranslation("history")
  const { exerciseName } = useCatalogLabels()
  const cells = groupCells(group)
  const completionTime = isRunComplete(cells)
    ? formatSecondsMMSS(runCompletionSeconds(cells))
    : null

  return (
    <button
      type="button"
      onClick={() => onOpen?.(group)}
      className="w-full rounded-lg border border-border/60 bg-muted/20 p-2.5 text-left transition-colors hover:bg-muted/40"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5 text-primary" aria-hidden />
        <p className="text-xs font-semibold text-foreground">
          {group.label ?? t("circuit.fallbackLabel")}
        </p>
        <span className="text-[10px] text-muted-foreground">
          · {t("circuit.rounds", { count: group.rounds.length })}
        </span>
        {completionTime != null && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-primary">
            <Timer className="h-3 w-3" aria-hidden />
            <span className="tabular-nums">
              {t("circuit.completionTime", { time: completionTime })}
            </span>
          </span>
        )}
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
                  <span className="flex-1 truncate">{exerciseName(cell)}</span>
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
    </button>
  )
}
