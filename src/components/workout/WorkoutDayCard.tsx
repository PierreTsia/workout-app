import { useTranslation } from "react-i18next"
import { Calendar, CheckCircle2 } from "lucide-react"
import type { WorkoutDay } from "@/types/database"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useLastSessionForDay } from "@/hooks/useLastSessionForDay"
import { ExerciseListPreview } from "./ExerciseListPreview"
import { cn } from "@/lib/utils"

interface WorkoutDayCardProps {
  day: WorkoutDay
  isActive: boolean
  isCycleDone: boolean
  shouldFetch: boolean
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

export function WorkoutDayCard({
  day,
  isActive,
  isCycleDone,
  shouldFetch,
}: WorkoutDayCardProps) {
  const { t } = useTranslation("workout")
  const { data: exercises } = useWorkoutExercises(shouldFetch ? day.id : null)
  const { data: lastSession } = useLastSessionForDay(shouldFetch ? day.id : null)

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card p-4 transition-shadow",
        isActive
          ? "border-primary/60 shadow-md shadow-primary/10"
          : "border-border",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{day.emoji}</span>
          <h3 className="font-semibold text-foreground">{day.label}</h3>
        </div>
        {isCycleDone && (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        )}
      </div>

      <div className="flex-1">
        {exercises && exercises.length > 0 ? (
          <ExerciseListPreview exercises={exercises} />
        ) : exercises ? (
          <p className="text-sm text-muted-foreground">{t("noExercises")}</p>
        ) : (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-muted" />
            ))}
          </div>
        )}
      </div>

      {lastSession && (
        <div className="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatRelativeDate(lastSession.finished_at)}</span>
          <span className="mx-1">·</span>
          <span>{t("setsDone")}: {lastSession.total_sets_done}</span>
        </div>
      )}
    </div>
  )
}
