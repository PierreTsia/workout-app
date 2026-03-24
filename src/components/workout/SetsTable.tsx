import { useState, useCallback, useEffect, useRef } from "react"
import { useAtom, useSetAtom } from "jotai"
import { Minus, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sessionAtom, restAtom, prFlagsAtom, sessionBest1RMAtom } from "@/store/atoms"
import { enqueueSetLog } from "@/lib/syncService"
import { computeEpley1RM } from "@/lib/epley"
import { computeIntraSessionSuggestion } from "@/lib/rirSuggestion"
import { useBest1RM } from "@/hooks/useBest1RM"
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

interface SetsTableProps {
  exercise: WorkoutExercise
  sessionId: string
  isReadOnly: boolean
  equipment?: string
  /** Called when the user tries to log sets while the workout timer is paused. */
  onBlockedByPause?: () => void
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
  isReadOnly,
  equipment,
  onBlockedByPause,
}: SetsTableProps) {
  const { t } = useTranslation("workout")
  const { unit, toKg } = useWeightUnit()
  const { data: libExercise } = useExerciseFromLibrary(exercise.exercise_id)
  const [session, setSession] = useAtom(sessionAtom)
  const setRest = useSetAtom(restAtom)
  const setPrFlags = useSetAtom(prFlagsAtom)
  const [sessionBest, setSessionBest] = useAtom(sessionBest1RMAtom)
  const { data: historicalBest = 0, isSuccess: best1RMReady } = useBest1RM(
    exercise.exercise_id,
  )

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
      exerciseSets[setIdx] = { ...cur, [field]: value }
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

      const runningBest = Math.max(
        historicalBest,
        sessionBest[exercise.exercise_id] ?? 0,
      )
      const wasPr =
        best1RMReady && estimatedOneRM > runningBest && estimatedOneRM > 0

      if (wasPr) {
        setPrFlags((prev) => ({ ...prev, [exercise.exercise_id]: true }))
      }

      setSessionBest((prev) => ({
        ...prev,
        [exercise.exercise_id]: Math.max(
          prev[exercise.exercise_id] ?? 0,
          estimatedOneRM,
        ),
      }))

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
      })

      exerciseSets[setIdx] = { ...currentSet, done: true, rir }

      setRest({
        startedAt: Date.now(),
        durationSeconds: exercise.rest_seconds,
        pausedAt: null,
        accumulatedPause: 0,
      })

      const nextIdx = setIdx + 1
      if (nextIdx < exerciseSets.length && !exerciseSets[nextIdx].done) {
        const nextRow = exerciseSets[nextIdx]
        if (isRepsRow(nextRow)) {
          const suggestion = computeIntraSessionSuggestion(
            rir,
            displayWeight,
            currentSet.reps,
            unit,
            equipment,
          )
          exerciseSets[nextIdx] = {
            ...nextRow,
            weight: String(suggestion.weight),
            reps: suggestion.reps,
          }
        }
      }

      setSession((prev) => ({
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
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
      best1RMReady,
      setSession,
      setRest,
      setPrFlags,
      setSessionBest,
      onBlockedByPause,
      session.pausedAt,
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
        enqueueSetLog({
          sessionId,
          exerciseId: exercise.exercise_id,
          exerciseNameSnapshot: exercise.name_snapshot,
          setNumber: setIdx + 1,
          weightLogged: weightKgForLog,
          loggedAt: Date.now(),
          durationSeconds,
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
      isReadOnly,
      session.pausedAt,
      onBlockedByPause,
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
