import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAtom, useSetAtom } from "jotai"
import { Link } from "react-router-dom"
import { Dumbbell, Loader2, Play } from "lucide-react"
import { sessionAtom, prFlagsAtom, sessionBest1RMAtom } from "@/store/atoms"
import { useWorkoutDays } from "@/hooks/useWorkoutDays"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useBootstrapProgram } from "@/hooks/useBootstrapProgram"
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

  // Auto-bootstrap a default program from system exercises on first visit
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

  // Initialize setsData for newly loaded exercises that don't have entries yet
  useEffect(() => {
    if (exercises.length === 0) return

    const missing = exercises.filter((ex) => !session.setsData[ex.id])
    if (missing.length === 0) return

    const newSetsData: Record<
      string,
      Array<{ reps: string; weight: string; done: boolean }>
    > = {}
    for (const ex of missing) {
      newSetsData[ex.id] = Array.from({ length: ex.sets }, () => ({
        reps: ex.reps,
        weight: ex.weight,
        done: false,
      }))
    }
    setSession((prev) => ({
      ...prev,
      setsData: { ...prev.setsData, ...newSetsData },
    }))
  }, [exercises, session.setsData, setSession])

  // PWA back-button trap
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

  // Loading state (including bootstrap in progress)
  if (daysLoading || bootstrap.isPending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        {bootstrap.isPending && (
          <p className="text-sm text-muted-foreground">
            Setting up your program...
          </p>
        )}
      </div>
    )
  }

  // Empty state -- bootstrap failed or no system exercises
  if (!days || days.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Dumbbell className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-bold">No workout program yet</h2>
        <p className="text-sm text-muted-foreground">
          {bootstrap.isError
            ? "Could not create a default program. Try the Builder instead."
            : "Create your first program in the Workout Builder to get started."}
        </p>
        <Button asChild>
          <Link to="/builder">Open Builder</Link>
        </Button>
      </div>
    )
  }

  // Session summary view
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
          <p className="text-muted-foreground">No exercises for this day.</p>
          <Button variant="outline" asChild size="sm">
            <Link to="/builder">Add exercises</Link>
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
                Start Workout
              </Button>
            </div>
          )}
        </>
      )}

      <RestTimerOverlay />

      {/* Exit dialog (PWA back-button) */}
      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit app?</DialogTitle>
            <DialogDescription>
              Your session state is automatically saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleExit}>
              Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
