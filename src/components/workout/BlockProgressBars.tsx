import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

interface BlockProgressBarsProps {
  /** 1-based current round and total rounds. Omit total for AMRAP (`Tour N`). */
  roundCurrent: number
  roundTotal?: number
  /** 1-based current exercise within the round and total exercises. */
  exerciseCurrent: number
  exerciseTotal: number
}

type Tone = "round" | "exercise"

function Bar({
  label,
  current,
  total,
  tone,
}: {
  label: string
  current: number
  total?: number
  tone: Tone
}) {
  const pct =
    total != null && total > 0
      ? Math.min(100, Math.max(0, (current / total) * 100))
      : 0
  const accent = tone === "round" ? "text-primary" : "text-amber-400"
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className={cn(
            "text-xs font-bold uppercase tracking-wider",
            accent,
          )}
        >
          {label}
        </span>
        <span
          data-testid={`block-${tone}-count`}
          className={cn("text-sm font-bold tabular-nums", accent)}
        >
          {current}
          {total != null && (
            <span className="text-muted-foreground">/{total}</span>
          )}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted/70">
        <div
          data-testid={`block-${tone}-fill`}
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            tone === "round"
              ? "bg-primary shadow-[0_0_10px] shadow-primary/40"
              : "bg-amber-400 shadow-[0_0_10px] shadow-amber-400/40",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Two labeled progress bars (round + exercise) with current/total counts and
 * distinct color coding — the at-a-glance "where am I in the block" header (#351).
 */
export function BlockProgressBars({
  roundCurrent,
  roundTotal,
  exerciseCurrent,
  exerciseTotal,
}: BlockProgressBarsProps) {
  const { t } = useTranslation("workout")
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Bar
        label={t("blockRunner.roundLabel")}
        current={roundCurrent}
        total={roundTotal}
        tone="round"
      />
      <Bar
        label={t("blockRunner.exerciseLabel")}
        current={exerciseCurrent}
        total={exerciseTotal}
        tone="exercise"
      />
    </div>
  )
}
