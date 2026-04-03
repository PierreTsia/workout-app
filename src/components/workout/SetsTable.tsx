import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { Minus, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sessionAtom, restAtom, prFlagsAtom, sessionBestPerformanceAtom } from "@/store/atoms"
import { enqueueSetLog } from "@/lib/syncService"
import { getRestElapsedSeconds } from "@/hooks/useRestTimer"
import { computeEpley1RM } from "@/lib/epley"
import {
  getPrModality,
  isPositivePrScore,
  scoreLiveDurationSet,
  scoreLiveRepSet,
} from "@/lib/prDetection"
import {
  computeCascadeSuggestions,
  parseTargetRepRange,
} from "@/lib/rirSuggestion"
import { useBestPerformance } from "@/hooks/useBestPerformance"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import type { WorkoutExercise } from "@/types/database"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { RirDrawer } from "@/components/workout/RirDrawer"
import { DurationSetTimer } from "@/components/workout/DurationSetTimer"
import {
  normalizeSessionSetRow,
  resolveTargetSecondsForRow,
  type SessionSetRow,
  type SessionSetRowDuration,
  type SessionSetRowReps,
} from "@/lib/sessionSetRow"
import { formatSecondsMMSS } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { ProgressionSuggestion } from "@/lib/progression"

interface SetsTableProps {
  exercise: WorkoutExercise
  sessionId: string
  /** Client session start (`sessionAtom.startedAt`) for PR prior-session logic when the DB row is missing. */
  sessionStartedAtMs?: number | null
  isReadOnly: boolean
  equipment?: string
  /** Called when the user tries to log sets while the workout timer is paused. */
  onBlockedByPause?: () => void
  suggestion?: ProgressionSuggestion | null
}

function isRepsRow(r: SessionSetRow): r is SessionSetRowReps {
  return r.kind === "reps"
}

function isDurationRow(r: SessionSetRow): r is SessionSetRowDuration {
  return r.kind === "duration"
}

export function SetsTable({
  exercise,
  sessionId,
  sessionStartedAtMs = null,
  isReadOnly,
  equipment,
  onBlockedByPause,
  suggestion = null,
}: SetsTableProps) {
  const { t } = useTranslation("workout")
  const { unit, toKg, toDisplay } = useWeightUnit()
  const { data: libExercise } = useExerciseFromLibrary(exercise.exercise_id)
  const [session, setSession] = useAtom(sessionAtom)
  const restSnapshot = useAtomValue(restAtom)
  const setRest = useSetAtom(restAtom)
  const setPrFlags = useSetAtom(prFlagsAtom)
  const [sessionBest, setSessionBest] = useAtom(sessionBestPerformanceAtom)

  const modality = useMemo(
    () =>
      getPrModality({
        measurement_type: libExercise?.measurement_type ?? "reps",
        equipment: libExercise?.equipment ?? equipment,
      }),
    [libExercise?.measurement_type, libExercise?.equipment, equipment],
  )

  const { data: perfData, isFetched: perfFetched } = useBestPerformance({
    exerciseId: exercise.exercise_id,
    localSessionId: sessionId,
    sessionStartedAtMs,
    measurementType: libExercise?.measurement_type,
    equipment: libExercise?.equipment ?? equipment,
  })

  const historicalBest = perfData?.bestValue ?? 0
  const hasPriorSession = perfData?.hasPriorSession ?? false

  const [pendingSetIdx, setPendingSetIdx] = useState<number | null>(null)

  const rawRows = session.setsData[exercise.id] ?? []
  const rows: SessionSetRow[] = rawRows.map((r) => normalizeSessionSetRow(r))
  const isDurationExercise = libExercise?.measurement_type === "duration"

  const isWorkoutPaused = session.pausedAt != null
  const pendingRirForUi = isWorkoutPaused ? null : pendingSetIdx

  // Migrate legacy reps rows to duration rows when the library confirms this is
  // a duration exercise. This happens when setsData was hydrated before the
  // library query resolved (reps is the fallback kind).
  useEffect(() => {
    if (!libExercise || libExercise.measurement_type !== "duration") return
    setSession((prev) => {
      const existing = (prev.setsData[exercise.id] ?? []).map(
        normalizeSessionSetRow,
      )
      if (existing.every((r) => r.kind === "duration")) return prev
      const targetSeconds = resolveTargetSecondsForRow(exercise, libExercise)
      const fixed = existing.map((r): SessionSetRow => {
        if (r.kind === "duration") return r
        return {
          kind: "duration",
          targetSeconds,
          weight: r.weight,
          done: r.done,
          timerStartedAt: null,
        }
      })
      return {
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: fixed },
      }
    })
  }, [libExercise, exercise, setSession])

  // Auto-apply progression suggestion to pre-fill set rows.
  // The pill becomes purely informational; the user can still override any value.
  const appliedProgressionRef = useRef<string | null>(null)
  useEffect(() => {
    if (!suggestion) return
    if (isReadOnly) return

    const isDurationSuggestion = suggestion.volumeType === "duration"
    const key = isDurationSuggestion
      ? `${exercise.id}:dur:${suggestion.duration}:${suggestion.weight}:${suggestion.sets}`
      : `${exercise.id}:${suggestion.reps}:${suggestion.weight}:${suggestion.sets}`
    if (appliedProgressionRef.current === key) return

    setSession((prev) => {
      const exerciseSets = [...(prev.setsData[exercise.id] ?? [])].map((r) =>
        normalizeSessionSetRow(r),
      )
      if (exerciseSets.some((r) => r.done)) {
        appliedProgressionRef.current = key
        return prev
      }

      const sugWeight = String(Math.round(toDisplay(suggestion.weight) * 10) / 10)

      if (isDurationSuggestion) {
        const sugDuration = suggestion.duration ?? 0
        const alreadyMatches =
          exerciseSets.every(
            (r) => isDurationRow(r) && r.targetSeconds === sugDuration && r.weight === sugWeight,
          ) && exerciseSets.length >= suggestion.sets
        if (alreadyMatches) {
          appliedProgressionRef.current = key
          return prev
        }

        const mapped: SessionSetRow[] = exerciseSets.map((r) => {
          if (!isDurationRow(r) || r.done) return r
          return { ...r, targetSeconds: sugDuration, weight: sugWeight }
        })

        const updated = mapped.concat(
          Array.from(
            { length: Math.max(0, suggestion.sets - mapped.length) },
            (): SessionSetRow => ({
              kind: "duration" as const,
              targetSeconds: sugDuration,
              weight: sugWeight,
              done: false,
              timerStartedAt: null,
            }),
          ),
        )

        appliedProgressionRef.current = key
        return {
          ...prev,
          setsData: { ...prev.setsData, [exercise.id]: updated },
        }
      }

      const sugReps = String(suggestion.reps)

      const alreadyMatches =
        exerciseSets.every(
          (r) => !isRepsRow(r) || (r.reps === sugReps && r.weight === sugWeight),
        ) && exerciseSets.length >= suggestion.sets
      if (alreadyMatches) {
        appliedProgressionRef.current = key
        return prev
      }

      const mapped: SessionSetRow[] = exerciseSets.map((r) => {
        if (!isRepsRow(r) || r.done) return r
        return { ...r, reps: sugReps, weight: sugWeight }
      })

      const updated = mapped.concat(
        Array.from(
          { length: Math.max(0, suggestion.sets - mapped.length) },
          (): SessionSetRow => ({
            kind: "reps" as const,
            reps: sugReps,
            weight: sugWeight,
            done: false,
          }),
        ),
      )

      appliedProgressionRef.current = key
      return {
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: updated },
      }
    })
  }, [suggestion, exercise.id, isReadOnly, setSession, toDisplay])

  const pauseStartRef = useRef<number | null>(null)
  /** Prevents duplicate duration completion when timer auto-log and "stop early" race the same tick. */
  const durationCompleteLockRef = useRef<string | null>(null)
  useEffect(() => {
    if (session.pausedAt != null) {
      pauseStartRef.current = session.pausedAt
    } else if (pauseStartRef.current != null) {
      const pauseMs = Date.now() - pauseStartRef.current
      pauseStartRef.current = null
      if (pauseMs <= 0 || !isDurationExercise) return
      setSession((prev) => {
        const exerciseSets = [...(prev.setsData[exercise.id] ?? [])].map((row) =>
          normalizeSessionSetRow(row),
        )
        let changed = false
        for (let i = 0; i < exerciseSets.length; i++) {
          const r = exerciseSets[i]
          if (
            isDurationRow(r) &&
            r.timerStartedAt != null &&
            !r.done
          ) {
            exerciseSets[i] = {
              ...r,
              timerStartedAt: r.timerStartedAt + pauseMs,
            }
            changed = true
          }
        }
        return changed
          ? {
              ...prev,
              setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
            }
          : prev
      })
    }
  }, [session.pausedAt, exercise.id, isDurationExercise, setSession])

  const weightLabel =
    equipment === "dumbbell"
      ? t("weightPerArm", { unit })
      : equipment === "bodyweight"
        ? t("addedWeight", { unit })
        : unit

  function updateField(
    setIdx: number,
    field: "reps" | "weight",
    value: string,
  ) {
    if (isReadOnly) return
    if (isWorkoutPaused) {
      onBlockedByPause?.()
      return
    }
    setSession((prev) => {
      const exerciseSets = [...(prev.setsData[exercise.id] ?? [])].map((r) =>
        normalizeSessionSetRow(r),
      )
      const cur = exerciseSets[setIdx]
      if (!cur || !isRepsRow(cur)) return prev
      if (cur[field] === value) return prev
      exerciseSets[setIdx] = {
        ...cur,
        [field]: value,
        ...(!cur.done && { manuallyEdited: true }),
      }
      return {
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
      }
    })
  }

  function handleCheckboxChange(setIdx: number) {
    if (isReadOnly) return
    if (isWorkoutPaused) {
      onBlockedByPause?.()
      return
    }
    const currentSet = rows[setIdx]
    if (!currentSet || !isRepsRow(currentSet)) return

    if (currentSet.done) {
      setSession((prev) => {
        const exerciseSets = [...(prev.setsData[exercise.id] ?? [])].map((r) =>
          normalizeSessionSetRow(r),
        )
        const cur = exerciseSets[setIdx]
        if (!cur || !isRepsRow(cur)) return prev
        exerciseSets[setIdx] = { ...cur, done: false, rir: undefined }
        return {
          ...prev,
          setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
          totalSetsDone: Math.max(0, prev.totalSetsDone - 1),
        }
      })
      return
    }

    setPendingSetIdx(setIdx)
  }

  const confirmRir = useCallback(
    (rir: number) => {
      const setIdx = pendingSetIdx
      if (setIdx === null) return
      if (session.pausedAt != null) {
        onBlockedByPause?.()
        return
      }
      setPendingSetIdx(null)

      const exerciseSets = [...(session.setsData[exercise.id] ?? [])].map((r) =>
        normalizeSessionSetRow(r),
      )
      const currentSet = exerciseSets[setIdx]
      if (!currentSet || !isRepsRow(currentSet) || currentSet.done) return

      const displayWeight = Number(currentSet.weight) || 0
      const weightKg = toKg(displayWeight)
      const reps = parseInt(currentSet.reps, 10)
      const estimatedOneRM = computeEpley1RM(weightKg, reps)
      const currentScore = scoreLiveRepSet(weightKg, reps, modality)

      const runningBest = Math.max(
        historicalBest,
        sessionBest[exercise.exercise_id] ?? 0,
      )
      const wasPr =
        perfFetched &&
        hasPriorSession &&
        currentScore > runningBest &&
        isPositivePrScore(currentScore, modality)

      if (wasPr) {
        setPrFlags((prev) => ({ ...prev, [exercise.exercise_id]: true }))
      }

      setSessionBest((prev) => ({
        ...prev,
        [exercise.exercise_id]: Math.max(
          prev[exercise.exercise_id] ?? 0,
          currentScore,
        ),
      }))

      const restSeconds = getRestElapsedSeconds(restSnapshot, session.pausedAt)

      enqueueSetLog({
        sessionId,
        exerciseId: exercise.exercise_id,
        exerciseNameSnapshot: exercise.name_snapshot,
        setNumber: setIdx + 1,
        repsLogged: currentSet.reps,
        weightLogged: weightKg,
        estimatedOneRM,
        wasPr,
        loggedAt: Date.now(),
        rir,
        restSeconds,
      })

      exerciseSets[setIdx] = { ...currentSet, done: true, rir }

      setRest({
        startedAt: Date.now(),
        durationSeconds: exercise.rest_seconds,
        pausedAt: null,
        accumulatedPause: 0,
      })

      const completedSets = exerciseSets
        .slice(0, setIdx + 1)
        .filter(
          (row): row is SessionSetRowReps & { rir: number } =>
            row.done && isRepsRow(row) && row.rir !== undefined,
        )
        .map(({ reps, weight, rir }) => ({
          reps: parseInt(reps, 10) || 0,
          weight: Number(weight) || 0,
          rir,
        }))

      const targetRepRange = parseTargetRepRange(exercise)

      const eligible = exerciseSets
        .map((row, i) => ({ row, i }))
        .filter(
          ({ row, i }) =>
            i > setIdx && !row.done && isRepsRow(row) && !row.manuallyEdited,
        )

      const suggestions =
        eligible.length > 0 && completedSets.length > 0
          ? computeCascadeSuggestions(
              completedSets,
              eligible.length,
              targetRepRange,
              unit,
              equipment ?? "",
            )
          : []

      const suggestionByIdx = new Map(
        eligible.map(({ i }, j) => [i, suggestions[j]] as const),
      )

      const updatedSets = exerciseSets.map((row, i) => {
        const suggestion = suggestionByIdx.get(i)
        if (!suggestion || !isRepsRow(row)) return row
        return { ...row, weight: String(suggestion.weight), reps: suggestion.reps }
      })

      setSession((prev) => ({
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: updatedSets },
        totalSetsDone: prev.totalSetsDone + 1,
      }))
    },
    [
      pendingSetIdx,
      session.setsData,
      exercise,
      sessionId,
      toKg,
      unit,
      equipment,
      historicalBest,
      sessionBest,
      perfFetched,
      hasPriorSession,
      modality,
      setSession,
      setRest,
      setPrFlags,
      setSessionBest,
      onBlockedByPause,
      session.pausedAt,
      restSnapshot,
    ],
  )

  const completeDurationSet = useCallback(
    (setIdx: number, durationSeconds: number) => {
      if (isReadOnly) return
      if (session.pausedAt != null) {
        onBlockedByPause?.()
        return
      }

      const lockKey = `${sessionId}:${exercise.id}:${setIdx}`
      if (durationCompleteLockRef.current === lockKey) return
      durationCompleteLockRef.current = lockKey

      let weightKgForLog = 0
      let didMarkDone = false

      setSession((prev) => {
        const exerciseSets = [...(prev.setsData[exercise.id] ?? [])].map((r) =>
          normalizeSessionSetRow(r),
        )
        const currentSet = exerciseSets[setIdx]
        if (!currentSet || !isDurationRow(currentSet) || currentSet.done) {
          durationCompleteLockRef.current = null
          return prev
        }

        const displayWeight = Number(currentSet.weight) || 0
        weightKgForLog = toKg(displayWeight)
        didMarkDone = true

        exerciseSets[setIdx] = {
          ...currentSet,
          done: true,
          timerStartedAt: null,
          loggedSeconds: durationSeconds,
        }

        return {
          ...prev,
          setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
          totalSetsDone: prev.totalSetsDone + 1,
        }
      })

      if (!didMarkDone) {
        return
      }

      try {
        const restSeconds = getRestElapsedSeconds(restSnapshot, session.pausedAt)

        const currentScore = scoreLiveDurationSet(durationSeconds)
        const runningBest = Math.max(
          historicalBest,
          sessionBest[exercise.exercise_id] ?? 0,
        )
        const wasPr =
          perfFetched &&
          hasPriorSession &&
          currentScore > runningBest &&
          currentScore > 0

        if (wasPr) {
          setPrFlags((prev) => ({ ...prev, [exercise.exercise_id]: true }))
        }

        setSessionBest((prev) => ({
          ...prev,
          [exercise.exercise_id]: Math.max(
            prev[exercise.exercise_id] ?? 0,
            currentScore,
          ),
        }))

        enqueueSetLog({
          sessionId,
          exerciseId: exercise.exercise_id,
          exerciseNameSnapshot: exercise.name_snapshot,
          setNumber: setIdx + 1,
          weightLogged: weightKgForLog,
          loggedAt: Date.now(),
          durationSeconds,
          wasPr,
          restSeconds,
        })

        setRest({
          startedAt: Date.now(),
          durationSeconds: exercise.rest_seconds,
          pausedAt: null,
          accumulatedPause: 0,
        })
      } finally {
        durationCompleteLockRef.current = null
      }
    },
    [
      exercise,
      sessionId,
      toKg,
      setSession,
      setRest,
      setPrFlags,
      setSessionBest,
      historicalBest,
      sessionBest,
      perfFetched,
      hasPriorSession,
      isReadOnly,
      session.pausedAt,
      onBlockedByPause,
      restSnapshot,
    ],
  )

  function removeLastSet() {
    if (isReadOnly) return
    if (isWorkoutPaused) {
      onBlockedByPause?.()
      return
    }
    setSession((prev) => {
      const exerciseSets = [...(prev.setsData[exercise.id] ?? [])].map((r) =>
        normalizeSessionSetRow(r),
      )
      const removed = exerciseSets.pop()
      const delta = removed && (isRepsRow(removed) || isDurationRow(removed)) && removed.done ? -1 : 0
      return {
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
        totalSetsDone: Math.max(0, prev.totalSetsDone + delta),
      }
    })
  }

  function addSet() {
    if (isReadOnly) return
    if (isWorkoutPaused) {
      onBlockedByPause?.()
      return
    }
    const lastRow = rows[rows.length - 1]
    setSession((prev) => {
      const exerciseSets = [...(prev.setsData[exercise.id] ?? [])].map((r) =>
        normalizeSessionSetRow(r),
      )
      if (isDurationExercise && libExercise) {
        const ts =
          lastRow && isDurationRow(lastRow)
            ? lastRow.targetSeconds
            : resolveTargetSecondsForRow(exercise, libExercise)
        const w =
          lastRow?.kind === "duration" || lastRow?.kind === "reps"
            ? lastRow.weight
            : exercise.weight
        exerciseSets.push({
          kind: "duration",
          targetSeconds: ts,
          weight: w,
          done: false,
          timerStartedAt: null,
        })
      } else {
        const lr = lastRow
        exerciseSets.push({
          kind: "reps",
          reps: lr && isRepsRow(lr) ? lr.reps : exercise.reps,
          weight:
            lr && (isRepsRow(lr) || isDurationRow(lr))
              ? lr.weight
              : exercise.weight,
          done: false,
        })
      }
      return {
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
      }
    })
  }

  if (rows.length === 0) return null

  if (isDurationExercise) {
    // Index of the row whose timer is currently ticking (at most one at a time).
    const activeTimerIdx = rows.findIndex(
      (r) => r.kind === "duration" && r.timerStartedAt != null && !r.done,
    )

    return (
      <div className="space-y-1">
        <div className="grid grid-cols-[2rem_1fr_2.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
          <span className="text-center">{t("setNumber")}</span>
          <span className="text-center">{t("durationHeader")}</span>
          <span />
        </div>

        {rows.map((set, idx) => (
          <div
            key={idx}
            className={cn(
              "grid grid-cols-[2rem_1fr_2.5rem] items-center gap-2 rounded-md px-1 py-1.5 transition-colors",
              set.kind === "duration" && set.done && "bg-primary/10",
            )}
          >
            <span className="text-center text-sm font-medium text-muted-foreground">
              {idx + 1}
            </span>

            {set.kind === "duration" && set.done ? (
              <>
                <span className="text-center font-mono text-sm tabular-nums text-muted-foreground">
                  {set.loggedSeconds != null
                    ? formatSecondsMMSS(set.loggedSeconds)
                    : "—"}
                </span>
                <div className="flex justify-center">
                  <Checkbox checked disabled />
                </div>
              </>
            ) : set.kind === "duration" ? (
              <DurationSetTimer
                targetSeconds={set.targetSeconds}
                timerStartedAt={set.timerStartedAt}
                disabled={
                  !session.isActive ||
                  isReadOnly ||
                  (activeTimerIdx !== -1 && activeTimerIdx !== idx)
                }
                isWorkoutPaused={isWorkoutPaused}
                onUpdateTarget={(seconds) => {
                  if (isReadOnly || isWorkoutPaused) return
                  setSession((prev) => {
                    const exerciseSets = [
                      ...(prev.setsData[exercise.id] ?? []),
                    ].map((r) => normalizeSessionSetRow(r))
                    const cur = exerciseSets[idx]
                    if (!cur || !isDurationRow(cur) || cur.done) return prev
                    exerciseSets[idx] = { ...cur, targetSeconds: seconds }
                    return {
                      ...prev,
                      setsData: {
                        ...prev.setsData,
                        [exercise.id]: exerciseSets,
                      },
                    }
                  })
                }}
                onStart={() => {
                  setRest(null)
                  setSession((prev) => {
                    const exerciseSets = [
                      ...(prev.setsData[exercise.id] ?? []),
                    ].map((r) => normalizeSessionSetRow(r))
                    const cur = exerciseSets[idx]
                    if (!cur || !isDurationRow(cur) || cur.done) return prev
                    exerciseSets[idx] = {
                      ...cur,
                      timerStartedAt: Date.now(),
                    }
                    return {
                      ...prev,
                      setsData: {
                        ...prev.setsData,
                        [exercise.id]: exerciseSets,
                      },
                    }
                  })
                }}
                onLog={(seconds) => completeDurationSet(idx, seconds)}
                onBlockedByPause={onBlockedByPause}
              />
            ) : null}
          </div>
        ))}

        <div className="flex items-center justify-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground active:text-destructive"
            onClick={(e) => {
              removeLastSet()
              ;(e.currentTarget as HTMLButtonElement).blur()
            }}
            disabled={
              rows.length <= 1 ||
              isReadOnly ||
              isWorkoutPaused ||
              (rows[rows.length - 1]?.kind === "duration" &&
                rows[rows.length - 1].done)
            }
            aria-label={t("removeLastSet")}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("setCount", { count: rows.length })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={addSet}
            disabled={isReadOnly || isWorkoutPaused}
            aria-label={t("addSet")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
        <span className="text-center">{t("setNumber")}</span>
        <span>{t("reps")}</span>
        <span
          className={
            equipment === "dumbbell" || equipment === "bodyweight"
              ? ""
              : "capitalize"
          }
        >
          {weightLabel}
        </span>
        <span className="text-center">{t("done")}</span>
      </div>

      {rows.map((set, idx) => (
        <div
          key={idx}
          className={cn(
            "grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2 rounded-md px-1 py-1.5 transition-colors",
            isRepsRow(set) && set.done && "bg-primary/10",
          )}
        >
          <span className="text-center text-sm font-medium text-muted-foreground">
            {idx + 1}
          </span>
          {isRepsRow(set) ? (
            <>
              <Input
                type="text"
                inputMode="numeric"
                value={set.reps}
                onChange={(e) => updateField(idx, "reps", e.target.value)}
                className="h-8 text-center"
                disabled={set.done || isReadOnly || isWorkoutPaused}
              />
              <Input
                type="text"
                inputMode="decimal"
                value={set.weight}
                onChange={(e) => updateField(idx, "weight", e.target.value)}
                className="h-8 text-center"
                disabled={set.done || isReadOnly || isWorkoutPaused}
              />
              <div className="flex justify-center">
                <Checkbox
                  checked={set.done}
                  onCheckedChange={() => handleCheckboxChange(idx)}
                  disabled={!session.isActive || isReadOnly || isWorkoutPaused}
                />
              </div>
            </>
          ) : null}
        </div>
      ))}

      <div className="flex items-center justify-center gap-1 pt-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground active:text-destructive"
          onClick={(e) => {
            removeLastSet()
            ;(e.currentTarget as HTMLButtonElement).blur()
          }}
          disabled={
            rows.length <= 1 ||
            isReadOnly ||
            isWorkoutPaused ||
            rows[rows.length - 1]?.done
          }
          aria-label={t("removeLastSet")}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t("setCount", { count: rows.length })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={addSet}
          disabled={isReadOnly || isWorkoutPaused}
          aria-label={t("addSet")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <RirDrawer
        key={pendingRirForUi ?? "closed"}
        open={pendingRirForUi !== null}
        setInfo={
          pendingRirForUi !== null && isRepsRow(rows[pendingRirForUi])
            ? {
                setNumber: pendingRirForUi + 1,
                reps: rows[pendingRirForUi].reps,
                weight: rows[pendingRirForUi].weight,
                unit,
              }
            : null
        }
        onConfirm={confirmRir}
      />
    </div>
  )
}
