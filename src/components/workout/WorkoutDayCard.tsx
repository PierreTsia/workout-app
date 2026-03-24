import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, Dumbbell, Layers, Timer } from "lucide-react"
import type { WorkoutDay } from "@/types/database"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useAggregatedMuscles } from "@/hooks/useAggregatedMuscles"
import { useLastSessionForDay } from "@/hooks/useLastSessionForDay"
import { BodyMap } from "@/components/body-map/BodyMap"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  formatRelativeDate,
  formatSessionDurationForDisplay,
} from "@/lib/formatters"

interface WorkoutDayCardProps {
  day: WorkoutDay
  isActive: boolean
  isCycleDone: boolean
  shouldFetch: boolean
}

export function WorkoutDayCard({
  day,
  isActive,
  isCycleDone,
  shouldFetch,
}: WorkoutDayCardProps) {
  const { t, i18n } = useTranslation("workout")
  const { data: exercises } = useWorkoutExercises(shouldFetch ? day.id : null)
  const heatmapData = useAggregatedMuscles(exercises ?? [])
  const { data: lastSession } = useLastSessionForDay(shouldFetch ? day.id : null)

  const estimatedTotalSets = useMemo(
    () => exercises?.reduce((sum, ex) => sum + ex.sets, 0) ?? 0,
    [exercises],
  )

  const lastSessionDateLabel = lastSession
    ? t("lastSession", {
        date: formatRelativeDate(lastSession.finished_at, i18n.language),
      })
    : null

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
        {isCycleDone && lastSessionDateLabel ? (
          <Badge variant="secondary" className="text-[11px] font-medium">
            {lastSessionDateLabel}
          </Badge>
        ) : !isCycleDone && lastSessionDateLabel ? (
          <span className="text-[11px] text-muted-foreground">
            {lastSessionDateLabel}
          </span>
        ) : (
          <span />
        )}
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
          <Badge
            variant={isCycleDone ? "secondary" : "outline"}
            className={cn(
              "gap-1.5",
              !isCycleDone && "text-muted-foreground",
            )}
          >
            <Dumbbell className="h-3 w-3" />
            {t("exerciseCount", { count: exercises.length })}
          </Badge>
        )}
        {isCycleDone && lastSession ? (
          <>
            <Badge variant="secondary" className="gap-1.5">
              <Layers className="h-3 w-3" />
              {t("setCount", { count: lastSession.total_sets_done })}
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <Timer className="h-3 w-3" />
              {formatSessionDurationForDisplay(
                lastSession.started_at,
                lastSession.finished_at,
                lastSession.active_duration_ms,
              )}
            </Badge>
          </>
        ) : !isCycleDone && exercises ? (
          <>
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <Layers className="h-3 w-3" />
              {t("estimatedSets", { count: estimatedTotalSets })}
            </Badge>
            {lastSession && (
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                <Timer className="h-3 w-3" />
                {t("estimatedDuration", {
                  duration: formatSessionDurationForDisplay(
                    lastSession.started_at,
                    lastSession.finished_at,
                    lastSession.active_duration_ms,
                  ),
                })}
              </Badge>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
