import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { Link } from "react-router-dom"
import { Dumbbell, Loader2, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sessionAtom, prFlagsAtom, sessionBest1RMAtom, isQuickWorkoutAtom, activeProgramIdAtom } from "@/store/atoms"
import { useWorkoutDays } from "@/hooks/useWorkoutDays"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useLastWeights } from "@/hooks/useLastWeights"
import { enqueueSessionFinish, scheduleImmediateDrain } from "@/lib/syncService"
import { DaySelector } from "@/components/workout/DaySelector"
import { ExerciseStrip } from "@/components/workout/ExerciseStrip"
import { ExerciseDetail } from "@/components/workout/ExerciseDetail"
import { SessionNav } from "@/components/workout/SessionNav"
import { RestTimerOverlay } from "@/components/workout/RestTimerOverlay"
import { SessionSummary } from "@/components/workout/SessionSummary"
import { QuickWorkoutSheet } from "@/components/generator/QuickWorkoutSheet"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function WorkoutPage() {
  const { t } = useTranslation("workout")
  const { toDisplay } = useWeightUnit()
  const [session, setSession] = useAtom(sessionAtom)
  const [prFlags, setPrFlags] = useAtom(prFlagsAtom)
  const setSessionBest1RM = useSetAtom(sessionBest1RMAtom)
  const [isQuickWorkout, setIsQuickWorkout] = useAtom(isQuickWorkoutAtom)
  const activeProgramId = useAtomValue(activeProgramIdAtom)
  const [finished, setFinished] = useState(false)
  const [finishedQuickInfo, setFinishedQuickInfo] = useState<{
    dayId: string
    name: string
  } | null>(null)
  const [exitDialogOpen, setExitDialogOpen] = useState(false)
  const [quickSheetOpen, setQuickSheetOpen] = useState(false)

  const { data: days, isLoading: daysLoading } = useWorkoutDays(activeProgramId)
  const { data: allExercisesForDay, isLoading: exercisesLoading } =
    useWorkoutExercises(session.currentDayId)

  const exercises = useMemo(
    () => allExercisesForDay ?? [],
    [allExercisesForDay],
  )

  const exerciseIds = useMemo(
    () => exercises.map((ex) => ex.exercise_id),
    [exercises],
  )
  const { data: lastWeights = {} } = useLastWeights(exerciseIds)
  const activeSessionDayId = session.activeDayId ?? session.currentDayId
  const isViewingLockedDay = Boolean(
    session.isActive &&
      activeSessionDayId &&
      session.currentDayId &&
      session.currentDayId !== activeSessionDayId,
  )
  const activeSessionDayLabel =
    days?.find((d) => d.id === activeSessionDayId)?.label ?? ""

  const [lockedDayView, setLockedDayView] = useState<{
    dayId: string | null
    index: number
  }>({ dayId: null, index: 0 })

  const lockedDayIndex =
    lockedDayView.dayId === session.currentDayId ? lockedDayView.index : 0

  const displayIndex = isViewingLockedDay
    ? Math.min(lockedDayIndex, Math.max(0, exercises.length - 1))
    : session.exerciseIndex

  const currentExercise = exercises[displayIndex] ?? null

  const sessionId = useMemo(() => {
    if (session.isActive && session.startedAt) {
      return `local-${session.startedAt}`
    }
    return "no-session"
  }, [session.isActive, session.startedAt])

  useEffect(() => {
    if (exercises.length === 0) return

    let hasChanges = false
    const patch: Record<
      string,
      Array<{ reps: string; weight: string; done: boolean }>
    > = {}

    for (const ex of exercises) {
      const existing = session.setsData[ex.id]
      const storedWeight = Number(ex.weight)
      const historyWeight = lastWeights[ex.exercise_id] ?? 0
      const effectiveWeightKg =
        storedWeight > 0 ? storedWeight : historyWeight

      if (!existing) {
        const displayWeight = String(
          Math.round(toDisplay(effectiveWeightKg) * 10) / 10,
        )
        patch[ex.id] = Array.from({ length: ex.sets }, () => ({
          reps: ex.reps,
          weight: displayWeight,
          done: false,
        }))
        hasChanges = true
      } else if (storedWeight === 0 && historyWeight > 0) {
        const allUntouched = existing.every(
          (s) => s.weight === "0" && !s.done,
        )
        if (allUntouched) {
          const displayWeight = String(
            Math.round(toDisplay(historyWeight) * 10) / 10,
          )
          patch[ex.id] = existing.map((s) => ({ ...s, weight: displayWeight }))
          hasChanges = true
        }
      }
    }

    if (hasChanges) {
      setSession((prev) => ({
        ...prev,
        setsData: { ...prev.setsData, ...patch },
      }))
    }
  }, [exercises, session.setsData, setSession, toDisplay, lastWeights])

  useEffect(() => {
    if (!session.isActive || session.activeDayId || !session.currentDayId) return
    setSession((prev) => ({ ...prev, activeDayId: prev.currentDayId }))
  }, [session.activeDayId, session.currentDayId, session.isActive, setSession])

  const handlePopState = useCallback(() => {
    setExitDialogOpen(true)
  }, [])

  useEffect(() => {
    history.pushState(null, "", location.href)
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [handlePopState])

  function handleCancel() {
    setExitDialogOpen(false)
    history.pushState(null, "", location.href)
  }

  function handleExit() {
    setExitDialogOpen(false)
    window.close()
  }

  const daySetsDone = useMemo(() => {
    return exercises.flatMap((ex) => session.setsData[ex.id] ?? []).filter(
      (s) => s.done,
    ).length
  }, [exercises, session.setsData])

  const exercisesCompleted = useMemo(() => {
    let count = 0
    for (const ex of exercises) {
      const sets = session.setsData[ex.id] ?? []
      if (sets.length > 0 && sets.every((s) => s.done)) {
        count++
      }
    }
    return count
  }, [exercises, session.setsData])

  const prExercises = useMemo(() => {
    return exercises
      .filter((ex) => prFlags[ex.exercise_id])
      .map((ex) => ({
        exerciseId: ex.exercise_id,
        name: ex.name_snapshot,
        emoji: ex.emoji_snapshot,
      }))
  }, [exercises, prFlags])

  function handleFinish() {
    const daySets = exercises.flatMap((ex) => session.setsData[ex.id] ?? [])
    const hasSkipped = daySets.some((s) => !s.done)

    enqueueSessionFinish({
      sessionId,
      workoutDayId: activeSessionDayId ?? "",
      workoutLabelSnapshot:
        days?.find((d) => d.id === activeSessionDayId)?.label ?? "",
      startedAt: session.startedAt ?? Date.now(),
      finishedAt: Date.now(),
      totalSetsDone: daySetsDone,
      hasSkippedSets: hasSkipped,
    })
    scheduleImmediateDrain()

    if (isQuickWorkout && session.currentDayId) {
      setFinishedQuickInfo({
        dayId: session.currentDayId,
        name:
          days?.find((d) => d.id === session.currentDayId)?.label ??
          "Quick Workout",
      })
    }
    setIsQuickWorkout(false)
    setSession((prev) => ({ ...prev, isActive: false, activeDayId: null }))
    setFinished(true)
  }

  function handleQuickWorkoutStart(dayId: string) {
    setSession((prev) => ({
      ...prev,
      currentDayId: dayId,
      exerciseIndex: 0,
      setsData: {},
      totalSetsDone: 0,
    }))
    setIsQuickWorkout(true)
    setTimeout(() => {
      startSession()
    }, 0)
  }

  function startSession() {
    setSession((prev) => ({
      ...prev,
      isActive: true,
      activeDayId: prev.currentDayId,
      startedAt: Date.now(),
      pausedAt: null,
      accumulatedPause: 0,
    }))
  }

  function handleNewSession() {
    setFinishedQuickInfo(null)
    setSession({
      currentDayId: null,
      activeDayId: null,
      exerciseIndex: 0,
      setsData: {},
      startedAt: null,
      isActive: false,
      totalSetsDone: 0,
      pausedAt: null,
      accumulatedPause: 0,
    })
    setPrFlags({})
    setSessionBest1RM({})
    setFinished(false)
  }

  if (daysLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!days || days.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Dumbbell className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-bold">{t("noProgram")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("createPrompt")}
        </p>
        {activeProgramId && (
          <Button asChild>
            <Link to={`/builder/${activeProgramId}`} state={{ from: "/" }}>
              {t("openBuilder")}
            </Link>
          </Button>
        )}
      </div>
    )
  }

  if (finished) {
    return (
      <SessionSummary
        setsDone={daySetsDone}
        exercisesCompleted={exercisesCompleted}
        totalExercises={exercises.length}
        prExercises={prExercises}
        onNewSession={handleNewSession}
        quickWorkoutDayId={finishedQuickInfo?.dayId}
        quickWorkoutName={finishedQuickInfo?.name}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <DaySelector days={days} onQuickWorkout={() => setQuickSheetOpen(true)} />

      {isViewingLockedDay && (
        <div className="mx-4 mt-3 mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <p>{t("crossDayReadOnlyTitle")}</p>
          <p className="text-xs text-amber-200/90">
            {t("crossDayReadOnlyBody", { day: activeSessionDayLabel })}
          </p>
        </div>
      )}

      {exercisesLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-muted-foreground">{t("noExercises")}</p>
          {activeProgramId && (
            <Button variant="outline" asChild size="sm">
              <Link to={`/builder/${activeProgramId}`} state={{ from: "/" }}>
                {t("addExercises")}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <ExerciseStrip
            exercises={exercises}
            activeIndex={displayIndex}
            onSelectIndex={
              isViewingLockedDay
                ? (idx) =>
                    setLockedDayView({
                      dayId: session.currentDayId,
                      index: idx,
                    })
                : (idx) =>
                    setSession((prev) => ({ ...prev, exerciseIndex: idx }))
            }
          />

          <div className="flex-1 overflow-y-auto py-2">
            {currentExercise && (
              <ExerciseDetail
                exercise={currentExercise}
                sessionId={sessionId}
                isReadOnly={isViewingLockedDay}
              />
            )}
          </div>

          {session.isActive && !isViewingLockedDay ? (
            <SessionNav
              exercises={exercises}
              onFinish={handleFinish}
            />
          ) : session.isActive ? (
            <div className="sticky bottom-0 border-t bg-background px-4 py-3 text-sm text-muted-foreground">
              {t("crossDayLockedFooter", { day: activeSessionDayLabel })}
            </div>
          ) : (
            <div className="sticky bottom-0 border-t bg-background px-4 py-3">
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={startSession}
              >
                <Play className="h-5 w-5" />
                {t("startWorkout")}
              </Button>
            </div>
          )}
        </>
      )}

      <RestTimerOverlay />

      <QuickWorkoutSheet
        open={quickSheetOpen}
        onOpenChange={setQuickSheetOpen}
        onStart={handleQuickWorkoutStart}
      />

      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("exitTitle")}</DialogTitle>
            <DialogDescription>
              {t("exitDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              {t("common:cancel")}
            </Button>
            <Button variant="destructive" onClick={handleExit}>
              {t("exit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
