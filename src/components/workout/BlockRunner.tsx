import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  Dumbbell,
  Info,
  Play,
  SkipForward,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useBlockSession } from "@/hooks/useBlockSession"
import { useCountdown } from "@/hooks/useCountdown"
import { useKeepScreenAwake } from "@/hooks/useKeepScreenAwake"
import { useExerciseById } from "@/hooks/useExerciseById"
import { playFinishBeeps } from "@/lib/audio"
import { BlockProgressBars } from "@/components/workout/BlockProgressBars"
import { CountdownRing } from "@/components/workout/CountdownRing"
import { ExerciseDetailSheet } from "@/components/generator/ExerciseDetailSheet"
import { blockCellKey, blockSetNumber } from "@/lib/blockSetLog"
import type { Cursor } from "@/lib/blockRunner"
import type { ExerciseBlockWithExercises } from "@/types/database"

interface BlockRunnerProps {
  block: ExerciseBlockWithExercises
  /** Active local session id (`local-${startedAt}`), used to tag set_logs. */
  localSessionId: string
  onExit?: () => void
  /** Fired once when every round/exercise is logged (block reaches "done"). */
  onComplete?: () => void
  /** Block was cancelled (logs cleared) — return to the session selector. */
  onCancel?: () => void
  /** Session is paused — release the screen wake lock while it is. */
  paused?: boolean
}

export function BlockRunner({
  block,
  localSessionId,
  onExit,
  onComplete,
  onCancel,
  paused = false,
}: BlockRunnerProps) {
  const { t } = useTranslation("workout")
  const { formatWeight } = useWeightUnit()
  const {
    state,
    remainingSeconds,
    logAndAdvance,
    skip,
    goBack,
    loggedCells,
    discardBlock,
  } = useBlockSession(block, localSessionId)

  const [cancelOpen, setCancelOpen] = useState(false)
  const confirmCancel = async () => {
    await discardBlock()
    setCancelOpen(false)
    ;(onCancel ?? onExit)?.()
  }

  // Last-resort escape hatch: nuke this block's logs and bail to the selector.
  const cancelSection = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCancelOpen(true)}
        className="mt-1 h-8 gap-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {t("blockRunner.cancelBlock")}
      </Button>
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("blockRunner.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("blockRunner.cancelBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("blockRunner.cancelKeep")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("blockRunner.cancelConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  const [infoExerciseId, setInfoExerciseId] = useState<string | null>(null)
  const { data: infoExercise } = useExerciseById(infoExerciseId)

  // Duration cell whose hold reached zero: awaiting an explicit "Validate".
  const [holdDone, setHoldDone] = useState(false)

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  useEffect(() => {
    if (state.phase === "done") onCompleteRef.current?.()
  }, [state.phase])

  // Keep the screen on for the whole run (holds + rests), not just while a timer
  // ticks — you shouldn't have to re-unlock between exercises mid-circuit (#351).
  useKeepScreenAwake(state.phase !== "done" && !paused)

  // Per-exercise hold timer for duration cells: at zero it stops and waits for an
  // explicit "Validate" rather than auto-advancing (early stop is a "Skip").
  const hold = useCountdown(() => {
    playFinishBeeps()
    setHoldDone(true)
  })

  // Reset any running hold whenever the cursor/phase moves to a different cell.
  const cursorKey =
    state.phase === "done"
      ? "done"
      : `${state.phase}:${state.cursor.round}:${state.cursor.exerciseIdx}`
  useEffect(() => {
    hold.cancel()
    setHoldDone(false)
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
        className="flex flex-1 flex-col px-5 pb-5 pt-7 text-center"
      >
        <div className="flex justify-center">{progressBars}</div>

        <div className="flex flex-1 flex-col items-center justify-center gap-5">
          <h2 className="text-2xl font-bold">{title}</h2>
          <CountdownRing remaining={remainingSeconds ?? 0} total={totalSeconds} />
          <p className="text-sm text-muted-foreground">{nextLabel}</p>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <div className="flex w-full max-w-sm gap-2">
            <Button variant="outline" onClick={goBack} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" />
              {t("blockRunner.back")}
            </Button>
            <Button onClick={skip} className="flex-1 gap-1.5">
              <SkipForward className="h-4 w-4" />
              {t("blockRunner.skip")}
            </Button>
          </div>
          {cancelSection}
        </div>
      </div>
    )
  }

  const { round, exerciseIdx } = state.cursor
  const blockExercise = block.exercises[exerciseIdx]
  const cell = blockExercise?.per_round[round]
  const amount = cell?.amount ?? 0
  const isFirstCell = round === 0 && exerciseIdx === 0
  const isDuration = blockExercise?.exercise?.measurement_type === "duration"
  // A cell revisited via Back is already validated: surface it and let the user
  // move on without re-logging (onLog is idempotent), so going back no longer
  // feels like it cancelled the previous exercise (#351).
  const alreadyLogged = blockExercise
    ? loggedCells.has(blockCellKey(blockExercise.id, blockSetNumber(round)))
    : false
  const centerValue =
    isDuration && hold.running
      ? (hold.remaining ?? 0)
      : isDuration && holdDone
        ? 0
        : amount

  return (
    <>
      <div
        role="region"
        aria-label={block.label ?? t("blockRunner.round", { current: round + 1, total: block.rounds })}
        className="flex flex-1 flex-col px-5 pb-5 pt-7 text-center"
      >
        <div className="flex justify-center">{progressBars}</div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-1.5">
            <div className="text-4xl">{blockExercise?.emoji_snapshot}</div>
            <h2 className="text-2xl font-bold leading-tight">
              {blockExercise?.name_snapshot}
            </h2>
            <div className="flex items-center gap-2">
              {blockExercise && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-muted-foreground"
                  onClick={() => setInfoExerciseId(blockExercise.exercise_id)}
                >
                  <Info className="h-4 w-4" />
                  {t("blockRunner.instructions")}
                </Button>
              )}
              {alreadyLogged && (
                <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("blockRunner.loggedBadge")}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <CountdownRing
              remaining={centerValue}
              total={amount}
              active={isDuration && (hold.running || holdDone)}
            >
              <span className="flex items-baseline gap-1">
                <span className="text-5xl font-bold tabular-nums">
                  {centerValue}
                </span>
                <span className="text-lg font-semibold text-muted-foreground">
                  {isDuration
                    ? t("blockRunner.secondsUnit")
                    : t("blockRunner.repsUnit")}
                </span>
              </span>
            </CountdownRing>
            {cell && cell.weight > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-base font-semibold tabular-nums">
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                {formatWeight(cell.weight)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <div className="flex w-full max-w-sm gap-2">
            <Button
              variant="outline"
              disabled={isFirstCell && !hold.running}
              onClick={goBack}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("blockRunner.back")}
            </Button>
            {alreadyLogged && !hold.running ? (
              // Already validated (revisited via Back): move forward, no re-log.
              <Button
                size="lg"
                onClick={logAndAdvance}
                className="flex-1 gap-1.5"
              >
                {t("blockRunner.continue")}
                <SkipForward className="h-5 w-5" />
              </Button>
            ) : isDuration && !hold.running && !holdDone ? (
              <Button
                size="lg"
                onClick={() => hold.start(amount)}
                className="flex-1 gap-1.5"
              >
                <Play className="h-5 w-5" />
                {t("durationStart")}
              </Button>
            ) : isDuration && hold.running ? (
              // Ending early is a skip, not a validation: reachable but quiet.
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  hold.cancel()
                  logAndAdvance()
                }}
                className="flex-1 gap-1.5"
              >
                <SkipForward className="h-5 w-5" />
                {t("blockRunner.skip")}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => {
                  hold.cancel()
                  setHoldDone(false)
                  logAndAdvance()
                }}
                className="flex-1 gap-1.5"
              >
                <Check className="h-5 w-5" />
                {t("blockRunner.log")}
              </Button>
            )}
          </div>
          {cancelSection}
        </div>
      </div>

      <ExerciseDetailSheet
        exercise={infoExercise ?? null}
        open={!!infoExerciseId && !!infoExercise}
        onOpenChange={(v) => {
          if (!v) setInfoExerciseId(null)
        }}
      />
    </>
  )
}
