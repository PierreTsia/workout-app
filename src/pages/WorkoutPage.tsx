import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAtom, useSetAtom } from "jotai"
import { Link } from "react-router-dom"
import { Dumbbell, Loader2, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sessionAtom, prFlagsAtom, sessionBest1RMAtom } from "@/store/atoms"
import { useWorkoutDays } from "@/hooks/useWorkoutDays"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useBootstrapProgram } from "@/hooks/useBootstrapProgram"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { enqueueSessionFinish } from "@/lib/syncService"
import { DaySelector } from "@/components/workout/DaySelector"
import { ExerciseStrip } from "@/components/workout/ExerciseStrip"
import { ExerciseDetail } from "@/components/workout/ExerciseDetail"
import { SessionNav } from "@/components/workout/SessionNav"
import { RestTimerOverlay } from "@/components/workout/RestTimerOverlay"
import { SessionSummary } from "@/components/workout/SessionSummary"
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
  const [finished, setFinished] = useState(false)
  const [exitDialogOpen, setExitDialogOpen] = useState(false)

  const { data: days, isLoading: daysLoading } = useWorkoutDays()
  const { data: allExercisesForDay, isLoading: exercisesLoading } =
    useWorkoutExercises(session.currentDayId)
  const bootstrap = useBootstrapProgram()
  const bootstrapAttempted = useRef(false)

  useEffect(() => {
    if (bootstrapAttempted.current) return
    if (daysLoading) return
    if (!days || days.length > 0) return

    bootstrapAttempted.current = true
    bootstrap.mutate()
  }, [daysLoading, days, bootstrap])

  const exercises = useMemo(
    () => allExercisesForDay ?? [],
    [allExercisesForDay],
  )

  const currentExercise = exercises[session.exerciseIndex] ?? null

  const sessionId = useMemo(() => {
    if (session.isActive && session.startedAt) {
      return `local-${session.startedAt}`
    }
    return "no-session"
  }, [session.isActive, session.startedAt])

  useEffect(() => {
    if (exercises.length === 0) return

    const missing = exercises.filter((ex) => !session.setsData[ex.id])
    if (missing.length === 0) return

    const newSetsData: Record<
      string,
      Array<{ reps: string; weight: string; done: boolean }>
    > = {}
    for (const ex of missing) {
      const displayWeight = String(
        Math.round(toDisplay(Number(ex.weight)) * 10) / 10,
      )
      newSetsData[ex.id] = Array.from({ length: ex.sets }, () => ({
        reps: ex.reps,
        weight: displayWeight,
        done: false,
      }))
    }
    setSession((prev) => ({
      ...prev,
      setsData: { ...prev.setsData, ...newSetsData },
    }))
  }, [exercises, session.setsData, setSession, toDisplay])

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
      workoutDayId: session.currentDayId ?? "",
      workoutLabelSnapshot:
        days?.find((d) => d.id === session.currentDayId)?.label ?? "",
      startedAt: session.startedAt ?? Date.now(),
      finishedAt: Date.now(),
      totalSetsDone: daySetsDone,
      hasSkippedSets: hasSkipped,
    })

    setFinished(true)
  }

  function startSession() {
    setSession((prev) => ({
      ...prev,
      isActive: true,
      startedAt: Date.now(),
      pausedAt: null,
      accumulatedPause: 0,
    }))
  }

  function handleNewSession() {
    setSession({
      currentDayId: null,
      exerciseIndex: 0,
      setsData: {},
      startedAt: null,
      isActive: false,
      totalSetsDone: 0,
    })
    setPrFlags({})
    setSessionBest1RM({})
    setFinished(false)
  }

  if (daysLoading || bootstrap.isPending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        {bootstrap.isPending && (
          <p className="text-sm text-muted-foreground">
            {t("settingUp")}
          </p>
        )}
      </div>
    )
  }

  if (!days || days.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Dumbbell className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-bold">{t("noProgram")}</h2>
        <p className="text-sm text-muted-foreground">
          {bootstrap.isError ? t("bootstrapError") : t("createPrompt")}
        </p>
        <Button asChild>
          <Link to="/builder">{t("openBuilder")}</Link>
        </Button>
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
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <DaySelector days={days} />

      {exercisesLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-muted-foreground">{t("noExercises")}</p>
          <Button variant="outline" asChild size="sm">
            <Link to="/builder">{t("addExercises")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <ExerciseStrip exercises={exercises} />

          <div className="flex-1 overflow-y-auto py-2">
            {currentExercise && (
              <ExerciseDetail
                exercise={currentExercise}
                sessionId={sessionId}
              />
            )}
          </div>

          {session.isActive ? (
            <SessionNav
              exercises={exercises}
              onFinish={handleFinish}
            />
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
