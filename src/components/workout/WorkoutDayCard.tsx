import { useTranslation } from "react-i18next"
import { CheckCircle2, Clock, Dumbbell } from "lucide-react"
import type { WorkoutDay } from "@/types/database"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useAggregatedMuscles } from "@/hooks/useAggregatedMuscles"
import { useLastSessionForDay } from "@/hooks/useLastSessionForDay"
import { BodyMap } from "@/components/body-map/BodyMap"
import { Badge } from "@/components/ui/badge"
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
        "rounded-xl border bg-card p-5 transition-shadow",
        isActive
          ? "border-primary/60 shadow-lg shadow-primary/10"
          : "border-border",
      )}
    >
      {/* Header: date badge + cycle done */}
      <div className="mb-1 flex items-center justify-between">
        {lastSession ? (
          <Badge variant="secondary" className="text-[11px] font-medium">
            {formatRelativeDate(lastSession.finished_at)}
          </Badge>
        ) : <span />}
        {isCycleDone && (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        )}
      </div>

      {/* Day title */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-2xl">{day.emoji}</span>
        <h3 className="text-xl font-bold text-foreground">{day.label}</h3>
      </div>

      {/* Body map (centered hero) */}
      <div className="flex items-center justify-center">
        {exercises && exercises.length > 0 ? (
          <BodyMap data={heatmapData} />
        ) : exercises ? null : (
          <div className="flex gap-3 py-6">
            <div className="h-28 w-14 animate-pulse rounded bg-muted" />
            <div className="h-28 w-14 animate-pulse rounded bg-muted" />
          </div>
        )}
      </div>

      {/* Badges row below body map */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {exercises && (
          <Badge variant="secondary" className="gap-1.5">
            <Dumbbell className="h-3 w-3" />
            {t("exerciseCount", { count: exercises.length })}
          </Badge>
        )}
        {lastSession && (
          <Badge variant="secondary" className="gap-1.5">
            <Clock className="h-3 w-3" />
            {t("setCount", { count: lastSession.total_sets_done })}
          </Badge>
        )}
      </div>
    </div>
  )
}
