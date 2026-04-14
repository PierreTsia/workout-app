import { useTranslation } from "react-i18next"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import { BarChart3, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useExerciseSessionHistorySheet } from "@/hooks/useExerciseSessionHistorySheet"
import {
  trendBestDurationSecondsPerSessionOldestFirst,
  trendBestE1RmKgPerSessionOldestFirst,
  trendBestRepsPerSessionOldestFirst,
} from "@/lib/exerciseHistorySheet"
import { ExerciseHistoryTrendChart } from "@/components/workout/ExerciseHistoryTrendChart"
import { ExerciseHistorySessionCard } from "@/components/workout/ExerciseHistorySessionCard"
import { BodyMap } from "@/components/body-map/BodyMap"
import { cn } from "@/lib/utils"

interface ExerciseHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseId: string
  exerciseName: string
  /** Shown as subtitle (localized snapshot). */
  muscleLabel: string
  /** Primary slug for BodyMap (library `muscle_group` when available). */
  bodyMapMuscleGroup: string
  emojiSnapshot: string
  imageUrl?: string | null
  secondaryMuscles?: string[] | null
  equipment?: string
  /** From exercise library; affects columns and trend chart. */
  measurementType?: "reps" | "duration"
}

export function ExerciseHistorySheet({
  open,
  onOpenChange,
  exerciseId,
  exerciseName,
  muscleLabel,
  bodyMapMuscleGroup,
  emojiSnapshot,
  imageUrl,
  secondaryMuscles,
  equipment,
  measurementType = "reps",
}: ExerciseHistorySheetProps) {
  const { t, i18n } = useTranslation("workout")
  const isOnline = useOnlineStatus()
  const { toDisplay, unit } = useWeightUnit()
  const { data, isLoading, isError, refetch, isFetching } =
    useExerciseSessionHistorySheet(open, exerciseId)

  const sessions = data ?? []
  const isDuration = measurementType === "duration"
  const isBodyweightReps = equipment === "bodyweight" && !isDuration
  const seriesKg = trendBestE1RmKgPerSessionOldestFirst(sessions)
  const seriesDurationSec = trendBestDurationSecondsPerSessionOldestFirst(sessions)
  const seriesReps = trendBestRepsPerSessionOldestFirst(sessions)
  const seriesForChart = isDuration
    ? seriesDurationSec
    : isBodyweightReps
      ? seriesReps
      : seriesKg.map((kg) => toDisplay(kg))
  const positiveCount = seriesForChart.filter((v) => v > 0).length
  const showTrend = sessions.length >= 2 && positiveCount >= 2
  const chronologicalSessions = [...sessions].reverse()
  const trendXLabels = chronologicalSessions.map((s) =>
    formatRelativeTime(s.finished_at, i18n.language),
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "flex max-h-[92vh] flex-col rounded-t-2xl border-x-0 border-t border-b-0 p-0",
        )}
      >
        <SheetHeader className="space-y-0 border-b border-border px-4 pb-3 pt-2 text-left">
          <div className="flex items-center gap-2 pr-10">
            <BarChart3 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <SheetTitle className="text-base font-semibold">
              {t("historySheet.title")}
            </SheetTitle>
          </div>
          <div className="flex items-start gap-3 pt-3">
            <ExerciseThumbnail
              imageUrl={imageUrl ?? undefined}
              emoji={emojiSnapshot}
              className="h-12 w-12 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{exerciseName}</p>
              <p className="text-sm text-muted-foreground">{muscleLabel}</p>
            </div>
            <BodyMap
              className="h-10 w-10 shrink-0 scale-90"
              muscleGroup={bodyMapMuscleGroup}
              secondaryMuscles={secondaryMuscles ?? undefined}
            />
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8 pt-3">
          {!isOnline ? (
            <p className="text-sm text-muted-foreground">{t("historySheet.offline")}</p>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              <span className="text-sm">{t("historySheet.loading")}</span>
            </div>
          ) : isError ? (
            <div className="space-y-3 py-4">
              <p className="text-sm text-destructive">
                {t("historySheet.loadError")}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                {t("historySheet.retry")}
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("historySheet.empty")}
            </p>
          ) : (
            <>
              {showTrend ? (
                <div className="mb-4 w-full">
                  <ExerciseHistoryTrendChart
                    variant={isDuration ? "duration" : isBodyweightReps ? "reps" : "e1rm"}
                    valuesDisplay={seriesForChart}
                    xLabels={trendXLabels}
                    unit={unit}
                  />
                </div>
              ) : (
                <p className="mb-4 text-center text-xs text-muted-foreground">
                  {isDuration
                    ? t("historySheet.trendHintDuration")
                    : isBodyweightReps
                      ? t("historySheet.trendHintBodyweight")
                      : t("historySheet.trendHint")}
                </p>
              )}

              <div
                className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label={t("historySheet.sessionsRegion")}
              >
                {sessions.map((s) => (
                  <ExerciseHistorySessionCard
                    key={s.session_id}
                    session={s}
                    equipment={equipment}
                    measurementType={measurementType}
                  />
                ))}
              </div>

              {isFetching && !isLoading ? (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {t("historySheet.refreshing")}
                </p>
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
