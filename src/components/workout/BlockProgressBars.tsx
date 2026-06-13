import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

interface BlockProgressBarsProps {
  /** 1-based current round and total rounds. */
  roundCurrent: number
  roundTotal: number
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
  total: number
  tone: Tone
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
        <span className={tone === "round" ? "text-primary" : "text-amber-400"}>
          {label}
        </span>
        <span
          data-testid={`block-${tone}-count`}
          className="tabular-nums text-muted-foreground"
        >
          {current}/{total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          data-testid={`block-${tone}-fill`}
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            tone === "round" ? "bg-primary" : "bg-amber-400",
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
    <div className="flex w-full max-w-xs flex-col gap-3">
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
