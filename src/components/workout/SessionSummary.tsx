import { useState } from "react"
import { useAtomValue } from "jotai"
import { Trophy, Clock, Dumbbell, RotateCcw } from "lucide-react"
import { sessionAtom } from "@/store/atoms"
import { Button } from "@/components/ui/button"

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`
  return `${m}m ${String(s).padStart(2, "0")}s`
}

interface SessionSummaryProps {
  setsDone: number
  exercisesCompleted: number
  totalExercises: number
  onNewSession: () => void
}

export function SessionSummary({
  setsDone,
  exercisesCompleted,
  totalExercises,
  onNewSession,
}: SessionSummaryProps) {
  const session = useAtomValue(sessionAtom)

  const [finishedAt] = useState(() => Date.now())
  const duration = session.startedAt
    ? formatDuration(finishedAt - session.startedAt)
    : "—"

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <Trophy className="h-16 w-16 text-primary" />
      <h2 className="text-2xl font-bold">Session Complete!</h2>

      <div className="grid w-full max-w-xs grid-cols-2 gap-4">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-card p-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-lg font-bold">{duration}</span>
          <span className="text-xs text-muted-foreground">Duration</span>
        </div>

        <div className="flex flex-col items-center gap-1 rounded-xl bg-card p-4">
          <Dumbbell className="h-5 w-5 text-muted-foreground" />
          <span className="text-lg font-bold">{setsDone}</span>
          <span className="text-xs text-muted-foreground">Sets done</span>
        </div>

        <div className="col-span-2 flex flex-col items-center gap-1 rounded-xl bg-card p-4">
          <span className="text-lg font-bold">
            {exercisesCompleted} / {totalExercises}
          </span>
          <span className="text-xs text-muted-foreground">
            Exercises completed
          </span>
        </div>
      </div>

      <Button size="lg" onClick={onNewSession} className="mt-4 gap-2">
        <RotateCcw className="h-4 w-4" />
        New Session
      </Button>
    </div>
  )
}
