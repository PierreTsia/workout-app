import { useAtom, useSetAtom } from "jotai"
import { Minus, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sessionAtom, restAtom, prFlagsAtom, sessionBest1RMAtom } from "@/store/atoms"
import { enqueueSetLog } from "@/lib/syncService"
import { computeEpley1RM } from "@/lib/epley"
import { useBest1RM } from "@/hooks/useBest1RM"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import type { WorkoutExercise } from "@/types/database"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SetsTableProps {
  exercise: WorkoutExercise
  sessionId: string
}

export function SetsTable({ exercise, sessionId }: SetsTableProps) {
  const { t } = useTranslation("workout")
  const { unit, toKg } = useWeightUnit()
  const [session, setSession] = useAtom(sessionAtom)
  const setRest = useSetAtom(restAtom)
  const setPrFlags = useSetAtom(prFlagsAtom)
  const [sessionBest, setSessionBest] = useAtom(sessionBest1RMAtom)
  const { data: historicalBest = 0, isSuccess: best1RMReady } = useBest1RM(exercise.exercise_id)

  const rows = session.setsData[exercise.id] ?? []

  function updateField(
    setIdx: number,
    field: "reps" | "weight",
    value: string,
  ) {
    setSession((prev) => {
      const exerciseSets = [...(prev.setsData[exercise.id] ?? [])]
      exerciseSets[setIdx] = { ...exerciseSets[setIdx], [field]: value }
      return {
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
      }
    })
  }

  function toggleDone(setIdx: number) {
    setSession((prev) => {
      const exerciseSets = [...(prev.setsData[exercise.id] ?? [])]
      const wasDone = exerciseSets[setIdx].done
      exerciseSets[setIdx] = { ...exerciseSets[setIdx], done: !wasDone }

      const delta = wasDone ? -1 : 1

      if (!wasDone) {
        const displayWeight = Number(exerciseSets[setIdx].weight) || 0
        const weightKg = toKg(displayWeight)
        const reps = parseInt(exerciseSets[setIdx].reps, 10)
        const estimatedOneRM = computeEpley1RM(weightKg, reps)

        const runningBest = Math.max(
          historicalBest,
          sessionBest[exercise.exercise_id] ?? 0,
        )
        const wasPr = best1RMReady && estimatedOneRM > runningBest && estimatedOneRM > 0

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

        setRest({
          startedAt: Date.now(),
          durationSeconds: exercise.rest_seconds,
        })

        enqueueSetLog({
          sessionId,
          exerciseId: exercise.exercise_id,
          exerciseNameSnapshot: exercise.name_snapshot,
          setNumber: setIdx + 1,
          repsLogged: exerciseSets[setIdx].reps,
          weightLogged: weightKg,
          estimatedOneRM,
          wasPr,
          loggedAt: Date.now(),
        })
      }

      return {
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
        totalSetsDone: Math.max(0, prev.totalSetsDone + delta),
      }
    })
  }

  function removeLastSet() {
    setSession((prev) => {
      const exerciseSets = [...(prev.setsData[exercise.id] ?? [])]
      const removed = exerciseSets.pop()
      const delta = removed?.done ? -1 : 0
      return {
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
        totalSetsDone: Math.max(0, prev.totalSetsDone + delta),
      }
    })
  }

  function addSet() {
    const lastRow = rows[rows.length - 1]
    setSession((prev) => {
      const exerciseSets = [...(prev.setsData[exercise.id] ?? [])]
      exerciseSets.push({
        reps: lastRow?.reps ?? exercise.reps,
        weight: lastRow?.weight ?? exercise.weight,
        done: false,
      })
      return {
        ...prev,
        setsData: { ...prev.setsData, [exercise.id]: exerciseSets },
      }
    })
  }

  if (rows.length === 0) return null

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
        <span className="text-center">{t("setNumber")}</span>
        <span>{t("reps")}</span>
        <span className="capitalize">{unit}</span>
        <span className="text-center">{t("done")}</span>
      </div>

      {rows.map((set, idx) => (
        <div
          key={idx}
          className={cn(
            "grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2 rounded-md px-1 py-1.5 transition-colors",
            set.done && "bg-primary/10",
          )}
        >
          <span className="text-center text-sm font-medium text-muted-foreground">
            {idx + 1}
          </span>
          <Input
            type="text"
            inputMode="numeric"
            value={set.reps}
            onChange={(e) => updateField(idx, "reps", e.target.value)}
            className="h-8 text-center"
            disabled={set.done}
          />
          <Input
            type="text"
            inputMode="decimal"
            value={set.weight}
            onChange={(e) => updateField(idx, "weight", e.target.value)}
            className="h-8 text-center"
            disabled={set.done}
          />
          <div className="flex justify-center">
            <Checkbox
              checked={set.done}
              onCheckedChange={() => toggleDone(idx)}
              disabled={!session.isActive}
            />
          </div>
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
          disabled={rows.length <= 1}
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
          aria-label={t("addSet")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
