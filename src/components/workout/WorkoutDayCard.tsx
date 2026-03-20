import { useTranslation } from "react-i18next"
import { Calendar, CheckCircle2, Clock, Dumbbell } from "lucide-react"
import type { WorkoutDay } from "@/types/database"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useAggregatedMuscles } from "@/hooks/useAggregatedMuscles"
import { useLastSessionForDay } from "@/hooks/useLastSessionForDay"
import { BodyMap } from "@/components/body-map/BodyMap"
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
  const heatmapData = useAggregatedMuscles(exercises ?? [])
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
      {/* Header: day label + cycle badge */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{day.emoji}</span>
          <h3 className="text-lg font-semibold text-foreground">{day.label}</h3>
        </div>
        {isCycleDone && (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        )}
      </div>

      {/* Body map hero */}
      <div className="flex-1 flex items-center justify-center py-2">
        {exercises && exercises.length > 0 ? (
          <BodyMap data={heatmapData} className="scale-90" />
        ) : exercises ? (
          <p className="text-sm text-muted-foreground">{t("noExercises")}</p>
        ) : (
          <div className="flex items-center justify-center gap-4 py-6">
            <div className="h-28 w-14 animate-pulse rounded bg-muted" />
            <div className="h-28 w-14 animate-pulse rounded bg-muted" />
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="mt-2 flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
        {exercises && (
          <span className="flex items-center gap-1">
            <Dumbbell className="h-3.5 w-3.5" />
            {exercises.length} {exercises.length === 1 ? "exercise" : "exercises"}
          </span>
        )}
        {lastSession && (
          <>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatRelativeDate(lastSession.finished_at)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {lastSession.total_sets_done} sets
            </span>
          </>
        )}
      </div>
    </div>
  )
}
