import { useTranslation } from "react-i18next"
import { CheckCircle2, Dumbbell, Layers, Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { compactNumberSequence } from "@/lib/blockPrescription"
import { cn } from "@/lib/utils"
import type {
  BlockExerciseWithExercise,
  ExerciseBlockWithExercises,
} from "@/types/database"

interface BlockSessionCardProps {
  block: ExerciseBlockWithExercises
  onStart: () => void
  disabled?: boolean
  /** Block already fully logged this session — show a done state + Restart. */
  completed?: boolean
}

/**
 * The inline slot for a block within the session sequence (#351): a summary +
 * Start that launches the full-screen {@link BlockRunner}. A block behaves like
 * any other exercise slot in Prev/Next navigation.
 */
export function BlockSessionCard({
  block,
  onStart,
  disabled,
  completed,
}: BlockSessionCardProps) {
  const { t } = useTranslation("workout")
  const { formatWeight } = useWeightUnit()

  const renderPrescription = (be: BlockExerciseWithExercise) => {
    const isDuration = be.exercise?.measurement_type === "duration"
    const amounts = be.per_round.map((c) => c.amount)
    const weights = be.per_round.map((c) => c.weight)
    const amountStr = compactNumberSequence(amounts)
    const amountLabel = isDuration
      ? `${amountStr}${t("blockRunner.secondsUnit")}`
      : `${amountStr} ${t("blockRunner.repsUnit")}`
    const minW = Math.min(...weights)
    const maxW = Math.max(...weights)
    const weightLabel =
      maxW > 0
        ? minW === maxW
          ? formatWeight(maxW)
          : `${formatWeight(minW)} – ${formatWeight(maxW)}`
        : null
    return (
      <span className="ml-auto flex shrink-0 items-center gap-2 text-xs">
        <span className="font-semibold tabular-nums">{amountLabel}</span>
        {weightLabel && (
          <span className="flex items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 font-medium text-muted-foreground">
            <Dumbbell className="h-3 w-3" />
            {weightLabel}
          </span>
        )}
      </span>
    )
  }

  return (
    <div
      className={cn(
        "mx-4 flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-colors",
        completed ? "border-green-500/50" : "border-border/60",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            completed ? "bg-green-500/15 text-green-500" : "bg-primary/15 text-primary",
          )}
        >
          <Layers className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">
            {block.label || t("blockRunner.defaultLabel")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("blockRunner.summary", {
              exercises: block.exercises.length,
              rounds: block.rounds,
            })}
          </p>
        </div>
        {completed && (
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-green-500/15 px-2 py-1 text-xs font-semibold text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("blockRunner.completed")}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        {block.exercises.map((be) => (
          <li
            key={be.id}
            className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm"
          >
            <span className="text-lg">{be.emoji_snapshot}</span>
            <span className="truncate font-medium">{be.name_snapshot}</span>
            {renderPrescription(be)}
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        variant={completed ? "outline" : "default"}
        className="w-full gap-2"
        disabled={disabled}
        onClick={onStart}
      >
        {completed ? (
          <RotateCcw className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
        {completed ? t("blockRunner.redo") : t("blockRunner.start")}
      </Button>
    </div>
  )
}
