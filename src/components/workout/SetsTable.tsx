import { useAtom, useSetAtom } from "jotai"
import { sessionAtom, restAtom } from "@/store/atoms"
import { enqueueSetLog } from "@/lib/syncService"
import type { WorkoutExercise } from "@/types/database"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface SetsTableProps {
  exercise: WorkoutExercise
  sessionId: string
}

export function SetsTable({ exercise, sessionId }: SetsTableProps) {
  const [session, setSession] = useAtom(sessionAtom)
  const setRest = useSetAtom(restAtom)

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
          weightLogged: Number(exerciseSets[setIdx].weight) || 0,
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

  if (rows.length === 0) return null

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
        <span className="text-center">#</span>
        <span>Reps</span>
        <span>Kg</span>
        <span className="text-center">✓</span>
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
            />
          </div>
        </div>
      ))}
    </div>
  )
}
