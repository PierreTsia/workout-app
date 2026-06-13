import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Check, ChevronLeft, Play, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useBlockSession } from "@/hooks/useBlockSession"
import { useCountdown } from "@/hooks/useCountdown"
import { playFinishBeeps } from "@/lib/audio"
import { BlockProgressBars } from "@/components/workout/BlockProgressBars"
import { CountdownRing } from "@/components/workout/CountdownRing"
import type { Cursor } from "@/lib/blockRunner"
import type {
  BlockExerciseWithExercise,
  ExerciseBlockWithExercises,
} from "@/types/database"

interface BlockRunnerProps {
  block: ExerciseBlockWithExercises
  /** Active local session id (`local-${startedAt}`), used to tag set_logs. */
  localSessionId: string
  onExit?: () => void
}

function useAmountLabel() {
  const { t } = useTranslation("workout")
  return (be: BlockExerciseWithExercise | undefined, round: number): string => {
    const amount = be?.per_round[round]?.amount ?? 0
    return be?.exercise?.measurement_type === "duration"
      ? t("blockRunner.seconds", { count: amount })
      : t("blockRunner.reps", { count: amount })
  }
}

export function BlockRunner({ block, localSessionId, onExit }: BlockRunnerProps) {
  const { t } = useTranslation("workout")
  const { formatWeight } = useWeightUnit()
  const amountLabel = useAmountLabel()
  const { state, remainingSeconds, logAndAdvance, skip, goBack } =
    useBlockSession(block, localSessionId)

  // Per-exercise hold timer for duration cells: auto-logs (and advances) at zero.
  const hold = useCountdown(() => {
    playFinishBeeps()
    logAndAdvance()
  })

  // Reset any running hold whenever the cursor/phase moves to a different cell.
  const cursorKey =
    state.phase === "done"
      ? "done"
      : `${state.phase}:${state.cursor.round}:${state.cursor.exerciseIdx}`
  useEffect(() => {
    hold.cancel()
  }, [cursorKey, hold.cancel])

  const exCount = block.exercises.length
  // The bars track the cell you're at (exercise phase) or heading to (rest/done).
  const pos: Cursor =
    state.phase === "exercise"
      ? state.cursor
      : state.phase === "transition" || state.phase === "roundRest"
        ? state.next
        : { round: block.rounds - 1, exerciseIdx: exCount - 1 }

  const progressBars = (
    <BlockProgressBars
      roundCurrent={pos.round + 1}
      roundTotal={block.rounds}
      exerciseCurrent={pos.exerciseIdx + 1}
      exerciseTotal={exCount}
    />
  )

  if (state.phase === "done") {
    return (
      <div
        role="region"
        aria-label={block.label ?? t("blockRunner.doneTitle")}
        className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      >
        {progressBars}
        <Check className="h-12 w-12 text-primary" />
        <h2 className="text-xl font-bold">{t("blockRunner.doneTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("blockRunner.doneBody")}</p>
        {onExit && (
          <Button className="mt-2" onClick={onExit}>
            {t("blockRunner.exit")}
          </Button>
        )}
      </div>
    )
  }

  if (state.phase === "transition" || state.phase === "roundRest") {
    const nextExercise = block.exercises[state.next.exerciseIdx]
    const title =
      state.phase === "transition"
        ? t("blockRunner.transitionTitle")
        : t("blockRunner.restTitle")
    const totalSeconds =
      state.phase === "transition" ? block.transition_seconds : block.rest_seconds
    const nextLabel =
      state.phase === "transition"
        ? t("blockRunner.next", { name: nextExercise?.name_snapshot ?? "" })
        : t("blockRunner.nextRound", { name: nextExercise?.name_snapshot ?? "" })

    return (
      <div
        role="region"
        aria-label={title}
        className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center"
      >
        {progressBars}
        <h2 className="text-2xl font-bold">{title}</h2>
        <CountdownRing
          remaining={remainingSeconds ?? 0}
          total={totalSeconds}
        />
        <p className="text-sm text-muted-foreground">{nextLabel}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={goBack} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />
            {t("blockRunner.back")}
          </Button>
          <Button onClick={skip} className="gap-1.5">
            <SkipForward className="h-4 w-4" />
            {t("blockRunner.skip")}
          </Button>
        </div>
      </div>
    )
  }

  const { round, exerciseIdx } = state.cursor
  const blockExercise = block.exercises[exerciseIdx]
  const cell = blockExercise?.per_round[round]
  const isFirstCell = round === 0 && exerciseIdx === 0
  const isDuration = blockExercise?.exercise?.measurement_type === "duration"
  const durationAmount = cell?.amount ?? 0

  return (
    <div
      role="region"
      aria-label={block.label ?? t("blockRunner.round", { current: round + 1, total: block.rounds })}
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
    >
      {progressBars}
      <div className="text-5xl">{blockExercise?.emoji_snapshot}</div>
      <h2 className="text-2xl font-bold">{blockExercise?.name_snapshot}</h2>
      {isDuration && hold.running ? (
        <CountdownRing remaining={hold.remaining ?? 0} total={durationAmount} />
      ) : (
        <p className="text-xl font-medium tabular-nums">
          {amountLabel(blockExercise, round)}
          {cell && cell.weight > 0 ? ` · ${formatWeight(cell.weight)}` : ""}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <Button
          variant="outline"
          disabled={isFirstCell && !hold.running}
          onClick={goBack}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("blockRunner.back")}
        </Button>
        {isDuration && !hold.running ? (
          <Button
            size="lg"
            onClick={() => hold.start(durationAmount)}
            className="gap-1.5"
          >
            <Play className="h-5 w-5" />
            {t("durationStart")}
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => {
              hold.cancel()
              logAndAdvance()
            }}
            className="gap-1.5"
          >
            <Check className="h-5 w-5" />
            {t("blockRunner.log")}
          </Button>
        )}
      </div>
    </div>
  )
}
