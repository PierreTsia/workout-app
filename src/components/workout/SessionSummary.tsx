import { useState } from "react"
import { useAtomValue } from "jotai"
import { Trophy, Clock, Dumbbell, RotateCcw, Flame, PartyPopper, Eye } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sessionAtom } from "@/store/atoms"
import { getEffectiveElapsed } from "@/lib/session"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import { Button } from "@/components/ui/button"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { SaveAsProgramPrompt } from "@/components/generator/SaveAsProgramPrompt"

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`
  return `${m}m ${String(s).padStart(2, "0")}s`
}

interface PrExercise {
  exerciseId: string
  name: string
  emoji: string
}

interface SessionSummaryProps {
  setsDone: number
  exercisesCompleted: number
  totalExercises: number
  prExercises: PrExercise[]
  onNewSession: () => void
  quickWorkoutDayId?: string
  quickWorkoutName?: string
  cycleComplete?: boolean
  cycleId?: string | null
}

export function SessionSummary({
  setsDone,
  exercisesCompleted,
  totalExercises,
  prExercises,
  onNewSession,
  quickWorkoutDayId,
  quickWorkoutName,
  cycleComplete,
  cycleId,
}: SessionSummaryProps) {
  const { t } = useTranslation("workout")
  const session = useAtomValue(sessionAtom)

  const [finishedAt] = useState(() => Date.now())
  const duration = session.startedAt
    ? formatDuration(getEffectiveElapsed(session, finishedAt))
    : "—"

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <Trophy className="h-16 w-16 text-primary" />

      {cycleComplete && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
          <PartyPopper className="h-4 w-4" />
          {t("cycleSummary.cycleCompleteBadge")}
        </span>
      )}

      <h2 className="text-2xl font-bold">{t("sessionComplete")}</h2>

      <div className="grid w-full max-w-xs grid-cols-2 gap-4">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-card p-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-lg font-bold">{duration}</span>
          <span className="text-xs text-muted-foreground">{t("duration")}</span>
        </div>

        <div className="flex flex-col items-center gap-1 rounded-xl bg-card p-4">
          <Dumbbell className="h-5 w-5 text-muted-foreground" />
          <span className="text-lg font-bold">{setsDone}</span>
          <span className="text-xs text-muted-foreground">{t("setsDone")}</span>
        </div>

        <div className="col-span-2 flex flex-col items-center gap-1 rounded-xl bg-card p-4">
          <span className="text-lg font-bold">
            {exercisesCompleted} / {totalExercises}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("exercisesCompleted")}
          </span>
        </div>
      </div>

      {prExercises.length > 0 && (
        <div className="w-full max-w-xs rounded-xl bg-card p-4">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Flame className="h-5 w-5 text-yellow-500" />
            <span className="text-sm font-semibold">
              {t("prCount", { count: prExercises.length })}
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {prExercises.map((pr) => (
              <PrBadge key={pr.exerciseId} pr={pr} />
            ))}
          </div>
        </div>
      )}

      {quickWorkoutDayId && (
        <div className="w-full max-w-xs">
          <SaveAsProgramPrompt
            dayId={quickWorkoutDayId}
            defaultName={quickWorkoutName ?? "Quick Workout"}
            onDone={onNewSession}
          />
        </div>
      )}

      <Button size="lg" onClick={onNewSession} className="mt-4 gap-2">
        {cycleComplete && cycleId ? (
          <>
            <Eye className="h-4 w-4" />
            {t("cycleSummary.viewSummary")}
          </>
        ) : (
          <>
            <RotateCcw className="h-4 w-4" />
            {t("newSession")}
          </>
        )}
      </Button>
    </div>
  )
}

function PrBadge({ pr }: { pr: PrExercise }) {
  const { data: libExercise } = useExerciseFromLibrary(pr.exerciseId)

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-500">
      <ExerciseThumbnail
        imageUrl={libExercise?.image_url}
        emoji={pr.emoji}
        className="h-4 w-4"
      />
      <span>{pr.name}</span>
    </span>
  )
}
