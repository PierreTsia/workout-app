import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { Link, useNavigate } from "react-router-dom"
import { Dumbbell, Loader2, Play, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import {
  sessionAtom,
  prFlagsAtom,
  sessionBest1RMAtom,
  isQuickWorkoutAtom,
  activeProgramIdAtom,
  authAtom,
  quickSheetOpenAtom,
  restAtom,
} from "@/store/atoms"
import { useWorkoutDays } from "@/hooks/useWorkoutDays"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useExerciseLibrary } from "@/hooks/useExerciseLibrary"
import {
  useAddExerciseToDay,
  useDeleteExercise,
  useSwapExerciseInDay,
} from "@/hooks/useBuilderMutations"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useLastWeights } from "@/hooks/useLastWeights"
import { useActiveCycle } from "@/hooks/useCycle"
import { enqueueSessionFinish, scheduleImmediateDrain } from "@/lib/syncService"
import { supabase } from "@/lib/supabase"
import { deriveCycleIdForSession } from "@/lib/cycle"
import { useLastSessionForDay } from "@/hooks/useLastSessionForDay"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import {
  summarizeSessionLogs,
  templateToPreviewItems,
} from "@/lib/sessionSummary"
import { mergeWorkoutExercises } from "@/lib/mergeWorkoutExercises"
import { canStartPreSession } from "@/lib/canStartPreSession"
import { fetchLastWeightsForExerciseIds } from "@/lib/lastWeightsFromSetLogs"
import { WorkoutDayCarousel } from "@/components/workout/WorkoutDayCarousel"
import { CycleProgressHeader } from "@/components/workout/CycleProgressHeader"
import { useCycleProgress } from "@/hooks/useCycle"
import { ExerciseStrip } from "@/components/workout/ExerciseStrip"
import { ExerciseDetail } from "@/components/workout/ExerciseDetail"
import { ExerciseListPreview } from "@/components/workout/ExerciseListPreview"
import { PreSessionExerciseList } from "@/components/workout/PreSessionExerciseList"
import {
  ExerciseEditScopeDialog,
  type ExerciseEditScope,
} from "@/components/workout/ExerciseEditScopeDialog"
import { SessionNav } from "@/components/workout/SessionNav"
import { SessionSummary } from "@/components/workout/SessionSummary"
import { QuickWorkoutSheet } from "@/components/generator/QuickWorkoutSheet"
import { ExerciseDetailSheet } from "@/components/generator/ExerciseDetailSheet"
import { SwapExerciseSheet } from "@/components/workout/SwapExerciseSheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  emptyPreSessionPatch,
  clonePreSessionPatch,
  type PreSessionExercisePatch,
} from "@/types/preSessionOverrides"
import type { Exercise, WorkoutExercise } from "@/types/database"

function templateWeightKgToString(kg: number): string {
  if (!kg || kg <= 0) return "0"
  return String(Math.round(kg * 10) / 10)
}

function isSyntheticRow(patch: PreSessionExercisePatch, rowId: string): boolean {
  return patch.addedRows.some((r) => r.id === rowId)
}

function applySessionSwap(
  prev: PreSessionExercisePatch,
  row: WorkoutExercise,
  picked: Exercise,
  weightStr: string,
): PreSessionExercisePatch {
  const next = clonePreSessionPatch(prev)
  const newRow: WorkoutExercise = {
    ...row,
    exercise_id: picked.id,
    name_snapshot: picked.name,
    muscle_snapshot: picked.muscle_group,
    emoji_snapshot: picked.emoji,
    weight: weightStr,
  }
  const addedIdx = next.addedRows.findIndex((r) => r.id === row.id)
  if (addedIdx >= 0) {
    next.addedRows[addedIdx] = newRow
  } else {
    next.swappedRows.set(row.id, newRow)
  }
  return next
}

function applySessionDelete(
  prev: PreSessionExercisePatch,
  row: WorkoutExercise,
): PreSessionExercisePatch {
  const next = clonePreSessionPatch(prev)
  const addedIdx = next.addedRows.findIndex((r) => r.id === row.id)
  if (addedIdx >= 0) {
    next.addedRows.splice(addedIdx, 1)
  } else {
    next.deletedIds.add(row.id)
    next.swappedRows.delete(row.id)
  }
  return next
}

function applySessionAdd(
  prev: PreSessionExercisePatch,
  row: WorkoutExercise,
): PreSessionExercisePatch {
  const next = clonePreSessionPatch(prev)
  next.addedRows.push(row)
  return next
}

type PendingScopeAction =
  | { kind: "swap"; row: WorkoutExercise; picked: Exercise }
  | { kind: "delete"; row: WorkoutExercise }
  | { kind: "add"; picked: Exercise }

export function WorkoutPage() {
  const { t } = useTranslation("workout")
  const { toDisplay } = useWeightUnit()
  const [session, setSession] = useAtom(sessionAtom)
  const [prFlags, setPrFlags] = useAtom(prFlagsAtom)
  const setSessionBest1RM = useSetAtom(sessionBest1RMAtom)
  const setRest = useSetAtom(restAtom)
  const [isQuickWorkout, setIsQuickWorkout] = useAtom(isQuickWorkoutAtom)
  const activeProgramId = useAtomValue(activeProgramIdAtom)
  const user = useAtomValue(authAtom)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: activeCycle } = useActiveCycle(activeProgramId)
  const { data: days, isLoading: daysLoading } = useWorkoutDays(activeProgramId)
  const cycleProgress = useCycleProgress(activeCycle?.id ?? null, days ?? [])
  const [finished, setFinished] = useState(false)
  const [finishedQuickInfo, setFinishedQuickInfo] = useState<{
    dayId: string
    name: string
  } | null>(null)
  const [exitDialogOpen, setExitDialogOpen] = useState(false)
  const [quickSheetOpen, setQuickSheetOpen] = useAtom(quickSheetOpenAtom)
  const [preSessionPatch, setPreSessionPatch] = useState<PreSessionExercisePatch>(
    () => emptyPreSessionPatch(),
  )
  const preSessionPatchRef = useRef(preSessionPatch)
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false)
  const [pendingScope, setPendingScope] = useState<PendingScopeAction | null>(
    null,
  )
  const [swapLibraryRowId, setSwapLibraryRowId] = useState<string | null>(null)
  const [addExerciseSheetOpen, setAddExerciseSheetOpen] = useState(false)
  const [inspectedExerciseId, setInspectedExerciseId] = useState<string | null>(
    null,
  )
  const [deleteLoggedWarnOpen, setDeleteLoggedWarnOpen] = useState(false)
  const [deleteLoggedWarnRow, setDeleteLoggedWarnRow] =
    useState<WorkoutExercise | null>(null)

  const addExerciseMutation = useAddExerciseToDay()
  const deleteExerciseMutation = useDeleteExercise()
  const swapExerciseMutation = useSwapExerciseInDay()
  const { data: exercisePool = [], isLoading: exercisePoolLoading } =
    useExerciseLibrary()

  const { data: allExercisesForDay, isLoading: exercisesLoading } =
    useWorkoutExercises(session.currentDayId)

  const baseExercises = useMemo(
    () => allExercisesForDay ?? [],
    [allExercisesForDay],
  )

  const exercises = useMemo(
    () => mergeWorkoutExercises(baseExercises, preSessionPatch),
    [baseExercises, preSessionPatch],
  )

  const swapLibraryRow = useMemo(
    () => exercises.find((e) => e.id === swapLibraryRowId) ?? null,
    [exercises, swapLibraryRowId],
  )

  const inspectedExercise = useMemo(
    () => exercisePool.find((e) => e.id === inspectedExerciseId) ?? null,
    [exercisePool, inspectedExerciseId],
  )

  const exerciseIds = useMemo(
    () => exercises.map((ex) => ex.exercise_id),
    [exercises],
  )

  const scopeMutationPending =
    addExerciseMutation.isPending ||
    deleteExerciseMutation.isPending ||
    swapExerciseMutation.isPending
  const { data: lastWeights = {} } = useLastWeights(exerciseIds)
  const activeSessionDayId = session.activeDayId ?? session.currentDayId
  const isDayDoneInCycle = cycleProgress.completedDayIds.includes(session.currentDayId ?? "")

  const { data: lastSessionForDay } = useLastSessionForDay(
    isDayDoneInCycle ? session.currentDayId : null,
  )
  const { data: sessionLogs } = useSessionSetLogs(lastSessionForDay?.id ?? null)

  const previewItems = useMemo(() => {
    if (isDayDoneInCycle && sessionLogs && sessionLogs.length > 0) {
      return summarizeSessionLogs(sessionLogs, baseExercises)
    }
    if (isDayDoneInCycle) {
      return templateToPreviewItems(baseExercises)
    }
    return []
  }, [isDayDoneInCycle, sessionLogs, baseExercises])

  useEffect(() => {
    preSessionPatchRef.current = preSessionPatch
  }, [preSessionPatch])

  // Reset ephemeral pre-session edits when browsing another day (not during active session).
  useEffect(() => {
    if (session.isActive) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- patch is scoped to currentDayId; must reset when atom updates from carousel
    setPreSessionPatch(emptyPreSessionPatch())
    setScopeDialogOpen(false)
    setPendingScope(null)
  }, [session.currentDayId, session.isActive])

  useEffect(() => {
    const keep = new Set(exercises.map((e) => e.id))
    setSession((prev) => {
      const next = { ...prev.setsData }
      let changed = false
      for (const key of Object.keys(next)) {
        if (!keep.has(key)) {
          delete next[key]
          changed = true
        }
      }
      return changed ? { ...prev, setsData: next } : prev
    })
  }, [exercises, setSession])

  const executeScopeChoice = useCallback(
    async (scope: ExerciseEditScope) => {
      if (!pendingScope) return
      const dayId = session.isActive
        ? (activeSessionDayId ?? session.currentDayId)
        : session.currentDayId
      if (!dayId) return
      const patchNow = preSessionPatchRef.current

      const refetchDayExercises = async () => {
        await queryClient.refetchQueries({ queryKey: ["workout-exercises", dayId] })
      }

      try {
        if (pendingScope.kind === "swap") {
          const { row, picked } = pendingScope
          const w = await fetchLastWeightsForExerciseIds([picked.id])
          const weightStr = templateWeightKgToString(w[picked.id] ?? 0)
          if (scope === "session") {
            setPreSessionPatch((p) => applySessionSwap(p, row, picked, weightStr))
          } else if (isSyntheticRow(patchNow, row.id)) {
            await addExerciseMutation.mutateAsync({
              dayId,
              exercise: picked,
              sortOrder: row.sort_order,
              weight: weightStr,
            })
            await refetchDayExercises()
            setPreSessionPatch((p) => {
              const n = clonePreSessionPatch(p)
              n.addedRows = n.addedRows.filter((r) => r.id !== row.id)
              return n
            })
          } else {
            await swapExerciseMutation.mutateAsync({
              id: row.id,
              dayId,
              exercise: picked,
              weight: weightStr,
            })
            await refetchDayExercises()
            setPreSessionPatch(emptyPreSessionPatch())
          }
        } else if (pendingScope.kind === "delete") {
          const { row } = pendingScope
          if (scope === "session") {
            setPreSessionPatch((p) => applySessionDelete(p, row))
          } else if (isSyntheticRow(patchNow, row.id)) {
            setPreSessionPatch((p) => applySessionDelete(p, row))
          } else {
            await deleteExerciseMutation.mutateAsync({ id: row.id, dayId })
            await refetchDayExercises()
            setPreSessionPatch(emptyPreSessionPatch())
          }
        } else {
          const { picked } = pendingScope
          const w = await fetchLastWeightsForExerciseIds([picked.id])
          const weightStr = templateWeightKgToString(w[picked.id] ?? 0)
          const maxSortSession =
            exercises.length === 0
              ? -1
              : Math.max(...exercises.map((e) => e.sort_order))
          const maxSortTemplate =
            baseExercises.length === 0
              ? -1
              : Math.max(...baseExercises.map((e) => e.sort_order))
          if (scope === "session") {
            const newRow: WorkoutExercise = {
              id: crypto.randomUUID(),
              workout_day_id: dayId,
              exercise_id: picked.id,
              name_snapshot: picked.name,
              muscle_snapshot: picked.muscle_group,
              emoji_snapshot: picked.emoji,
              sets: 3,
              reps: "12",
              weight: weightStr,
              rest_seconds: 90,
              sort_order: maxSortSession + 1,
            }
            setPreSessionPatch((p) => applySessionAdd(p, newRow))
          } else {
            await addExerciseMutation.mutateAsync({
              dayId,
              exercise: picked,
              sortOrder: maxSortTemplate + 1,
              weight: weightStr,
            })
            await refetchDayExercises()
            setPreSessionPatch(emptyPreSessionPatch())
          }
        }
        setScopeDialogOpen(false)
        setPendingScope(null)
      } catch {
        toast.error(t("preSession.mutationError"))
      }
    },
    [
      pendingScope,
      session.isActive,
      session.currentDayId,
      activeSessionDayId,
      exercises,
      baseExercises,
      queryClient,
      addExerciseMutation,
      deleteExerciseMutation,
      swapExerciseMutation,
      t,
    ],
  )

  const isViewingLockedDay = Boolean(
    session.isActive &&
      activeSessionDayId &&
      session.currentDayId &&
      session.currentDayId !== activeSessionDayId,
  )
  const activeSessionDayLabel =
    days?.find((d) => d.id === activeSessionDayId)?.label ?? ""

  const openExerciseDeleteFlow = useCallback((row: WorkoutExercise) => {
    const logged = session.setsData[row.id]?.some((s) => s.done) ?? false
    if (logged) {
      setDeleteLoggedWarnRow(row)
      setDeleteLoggedWarnOpen(true)
    } else {
      setPendingScope({ kind: "delete", row })
      setScopeDialogOpen(true)
    }
  }, [session.setsData])

  const exerciseDetailEditSession = useMemo(() => {
    if (!session.isActive || isViewingLockedDay) return null
    return {
      exercisePool,
      poolLoading: exercisePoolLoading,
      allExercises: exercises,
      onSwapExerciseChosen: (row: WorkoutExercise, picked: Exercise) => {
        setPendingScope({ kind: "swap", row, picked })
        setScopeDialogOpen(true)
      },
      onDeleteRequested: openExerciseDeleteFlow,
      onSwapBrowseLibrary: (row: WorkoutExercise) => {
        setSwapLibraryRowId(row.id)
      },
    }
  }, [
    session.isActive,
    isViewingLockedDay,
    exercisePool,
    exercisePoolLoading,
    exercises,
    openExerciseDeleteFlow,
  ])

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

  useEffect(() => {
    if (!session.isActive) return
    if (exercises.length === 0) return
    setSession((prev) => {
      if (prev.exerciseIndex < exercises.length) return prev
      return { ...prev, exerciseIndex: Math.max(0, exercises.length - 1) }
    })
  }, [session.isActive, exercises.length, setSession])

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
      cycleId: session.cycleId,
    })
    scheduleImmediateDrain()

    if (session.cycleId) {
      queryClient.setQueryData<{ workout_day_id: string | null }[]>(
        ["cycle-sessions", session.cycleId],
        (old) => [
          ...(old ?? []),
          { workout_day_id: activeSessionDayId ?? null },
        ],
      )
    }

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
    setRest(null)
    setFinished(true)
  }

  function handleQuickWorkoutStart(dayId: string) {
    setPreSessionPatch(emptyPreSessionPatch())
    setSession((prev) => ({
      ...prev,
      currentDayId: dayId,
      exerciseIndex: 0,
      setsData: {},
      totalSetsDone: 0,
    }))
    setIsQuickWorkout(true)
    setTimeout(() => {
      startSession({ skipCycle: true })
    }, 0)
  }

  async function startSession({ skipCycle = false } = {}) {
    let cycleId = deriveCycleIdForSession(skipCycle, activeCycle?.id ?? null)

    if (!cycleId && activeProgramId && user && !skipCycle) {
      try {
        const { data, error } = await supabase
          .from("cycles")
          .insert({ program_id: activeProgramId, user_id: user.id })
          .select()
          .single()

        if (error?.code === "23505") {
          // Unique constraint race — another tab created one; refetch
          await queryClient.invalidateQueries({ queryKey: ["active-cycle", activeProgramId] })
          const refetched = queryClient.getQueryData<{ id: string } | null>(["active-cycle", activeProgramId])
          cycleId = refetched?.id ?? null
        } else if (error) {
          console.warn("[WorkoutPage] Could not create cycle:", error.message)
        } else {
          cycleId = data.id
          queryClient.invalidateQueries({ queryKey: ["active-cycle", activeProgramId] })
        }
      } catch {
        // Offline — start without cycle
      }
    }

    setSession((prev) => ({
      ...prev,
      isActive: true,
      activeDayId: prev.currentDayId,
      startedAt: Date.now(),
      pausedAt: null,
      accumulatedPause: 0,
      cycleId,
    }))
  }

  function handleNewSession() {
    const shouldNavigateToSummary = finished && cycleProgress.isComplete && session.cycleId
    const cycleIdForNav = session.cycleId

    setPreSessionPatch(emptyPreSessionPatch())
    setFinishedQuickInfo(null)
    setRest(null)
    setSession({
      currentDayId: null,
      activeDayId: null,
      exerciseIndex: 0,
      setsData: {},
      startedAt: null,
      isActive: false,
      totalSetsDone: 0,
      pausedAt: null,
      cycleId: null,
      accumulatedPause: 0,
    })
    setPrFlags({})
    setSessionBest1RM({})
    setFinished(false)

    if (shouldNavigateToSummary && cycleIdForNav) {
      navigate(`/cycle-summary/${cycleIdForNav}`)
    }
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
        cycleComplete={cycleProgress.isComplete}
        cycleId={session.cycleId}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {session.isActive ? (
        /* ── Active session ── */
        <>
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
              {!isViewingLockedDay ? (
                <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/25 px-4 py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("session.exercisesToolbar")}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => setAddExerciseSheetOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    {t("preSession.addExercise")}
                  </Button>
                </div>
              ) : null}
              <div className="flex-1 overflow-y-auto py-2">
                {currentExercise && (
                  <ExerciseDetail
                    exercise={currentExercise}
                    sessionId={sessionId}
                    isReadOnly={isViewingLockedDay}
                    editSession={exerciseDetailEditSession}
                  />
                )}
              </div>
              {!isViewingLockedDay ? (
                <SessionNav exercises={exercises} onFinish={handleFinish} />
              ) : (
                <div className="sticky bottom-0 border-t bg-background px-4 py-3 text-sm text-muted-foreground">
                  {t("crossDayLockedFooter", { day: activeSessionDayLabel })}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* ── Pre-session: hero card → exercises → start ── */
        <>
          <div className={cn("flex-1 overflow-y-auto space-y-4", !isDayDoneInCycle && "pb-20")}>
            {!cycleProgress.isComplete && cycleProgress.totalDays > 0 && activeCycle && (
              <CycleProgressHeader
                completedCount={cycleProgress.completedDayIds.length}
                totalDays={cycleProgress.totalDays}
              />
            )}

            <WorkoutDayCarousel
              days={days}
              completedDayIds={cycleProgress.completedDayIds}
            />

            {/* Exercise list for selected day */}
            {isDayDoneInCycle && previewItems.length > 0 && (
              <div className="px-4">
                <ExerciseListPreview items={previewItems} />
              </div>
            )}
            {!isDayDoneInCycle && (
              <div className="px-4">
                <PreSessionExerciseList
                  exercises={exercises}
                  exercisePool={exercisePool}
                  poolLoading={exercisePoolLoading}
                  onSwapExerciseChosen={(row, picked) => {
                    setPendingScope({ kind: "swap", row, picked })
                    setScopeDialogOpen(true)
                  }}
                  onDeleteRequested={openExerciseDeleteFlow}
                  onSwapBrowseLibrary={(row) => setSwapLibraryRowId(row.id)}
                  onRequestAddExerciseSheet={() => setAddExerciseSheetOpen(true)}
                  onInspectExercise={(id) => setInspectedExerciseId(id)}
                />
              </div>
            )}
          </div>

          {!isDayDoneInCycle && (
            <div className="sticky bottom-0 space-y-2 border-t bg-background px-4 py-3">
              {exercises.length > 0 && !canStartPreSession(exercises) ? (
                <p className="text-center text-xs text-muted-foreground">
                  {t("preSession.startBlocked")}
                </p>
              ) : null}
              <Button
                className="w-full gap-2"
                size="lg"
                disabled={!canStartPreSession(exercises)}
                onClick={() => startSession()}
              >
                <Play className="h-5 w-5" />
                {t("startWorkout")}
              </Button>
            </div>
          )}
        </>
      )}

      <ExerciseEditScopeDialog
        open={scopeDialogOpen}
        onOpenChange={(open) => {
          setScopeDialogOpen(open)
          if (!open) setPendingScope(null)
        }}
        title={
          pendingScope?.kind === "swap"
            ? t("preSession.scopeTitleSwap")
            : pendingScope?.kind === "delete"
              ? t("preSession.scopeTitleDelete")
              : pendingScope?.kind === "add"
                ? t("preSession.scopeTitleAdd")
                : ""
        }
        description={t("preSession.scopeDescription")}
        swapHint={pendingScope?.kind === "swap"}
        isPending={scopeMutationPending}
        onChoose={(scope) => {
          void executeScopeChoice(scope)
        }}
      />

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

      <SwapExerciseSheet
        open={!!swapLibraryRow}
        onOpenChange={(open) => {
          if (!open) setSwapLibraryRowId(null)
        }}
        currentExerciseIds={exercises.map((e) => e.exercise_id)}
        onSelect={(picked) => {
          if (!swapLibraryRow) return
          setPendingScope({ kind: "swap", row: swapLibraryRow, picked })
          setScopeDialogOpen(true)
          setSwapLibraryRowId(null)
        }}
      />

      <SwapExerciseSheet
        open={addExerciseSheetOpen}
        onOpenChange={setAddExerciseSheetOpen}
        currentExerciseIds={exercises.map((e) => e.exercise_id)}
        title={t("preSession.addExercise")}
        onSelect={(picked) => {
          setPendingScope({ kind: "add", picked })
          setScopeDialogOpen(true)
          setAddExerciseSheetOpen(false)
        }}
      />

      <ExerciseDetailSheet
        exercise={inspectedExercise}
        open={!!inspectedExercise}
        onOpenChange={(v) => {
          if (!v) setInspectedExerciseId(null)
        }}
      />

      <Dialog
        open={deleteLoggedWarnOpen}
        onOpenChange={(open) => {
          setDeleteLoggedWarnOpen(open)
          if (!open) setDeleteLoggedWarnRow(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("preSession.deleteLoggedTitle")}</DialogTitle>
            <DialogDescription>
              {t("preSession.deleteLoggedDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteLoggedWarnOpen(false)
                setDeleteLoggedWarnRow(null)
              }}
            >
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteLoggedWarnRow) {
                  setPendingScope({ kind: "delete", row: deleteLoggedWarnRow })
                  setScopeDialogOpen(true)
                }
                setDeleteLoggedWarnOpen(false)
                setDeleteLoggedWarnRow(null)
              }}
            >
              {t("preSession.deleteLoggedContinue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
