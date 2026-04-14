import { useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Loader2, PartyPopper, SkipForward } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExerciseEditForm } from "@/components/admin/exercise-form/ExerciseEditForm"
import { ExerciseReviewToolbar } from "@/components/admin/review/ExerciseReviewToolbar"
import { fromFormValues } from "@/components/admin/exercise-form/transforms"
import { useAdminUpdateExercise } from "@/hooks/useAdminUpdateExercise"
import {
  useExercisesForReview,
  useReviewTotalCount,
  REVIEW_QUEUE_KEY,
} from "@/hooks/useExercisesForReview"
import type { ExerciseFormValues } from "@/components/admin/exercise-form/schema"

export function AdminReviewPage() {
  const { t } = useTranslation("admin")
  const queryClient = useQueryClient()
  const { data: exercises, isLoading } = useExercisesForReview()
  const { data: totalCount } = useReviewTotalCount()
  const [currentIndex, setCurrentIndex] = useState(0)

  const remaining = exercises?.length ?? 0
  const total = totalCount ?? remaining
  const done = total - remaining

  const exercise = remaining > 0 ? exercises![currentIndex] : null
  const mutation = useAdminUpdateExercise(exercise?.id ?? "")

  const advanceToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const nextRemaining = remaining - 1
      if (nextRemaining <= 0) return 0
      return prev >= nextRemaining ? 0 : prev
    })
  }, [remaining])

  function handleSubmit(values: ExerciseFormValues) {
    if (!exercise) return
    const payload = fromFormValues(values)
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t("toast.saveSuccess"))
        queryClient.invalidateQueries({ queryKey: [REVIEW_QUEUE_KEY] })
        advanceToNext()
      },
      onError: () => {
        toast.error(t("toast.saveError"))
      },
    })
  }

  function handleSkip() {
    if (remaining <= 1) return
    setCurrentIndex((prev) => (prev + 1) % remaining)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">{t("review.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("review.description")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : remaining === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <PartyPopper className="h-12 w-12 text-primary" />
          <div>
            <p className="text-lg font-semibold">{t("review.allDone")}</p>
            <p className="text-sm text-muted-foreground">
              {t("review.allDoneHint")}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin">{t("review.backToAdmin")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{
                  width: total > 0 ? `${(done / total) * 100}%` : "0%",
                }}
              />
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
              {done}/{total}
            </span>
          </div>

          <div className="flex flex-col gap-5 rounded-xl border border-border/80 bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none">
                  {exercise!.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold leading-tight">
                    {exercise!.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {exercise!.muscle_group} · {exercise!.equipment}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {exercise!.usage_count > 0 && (
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {t("review.usedCount", {
                      count: exercise!.usage_count,
                    })}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="text-xs text-muted-foreground"
                >
                  {currentIndex + 1}/{remaining}
                </Badge>
              </div>
            </div>

            <ExerciseReviewToolbar exercise={exercise!} />

            <ExerciseEditForm
              key={exercise!.id}
              exercise={exercise!}
              onSubmit={handleSubmit}
              isPending={mutation.isPending}
            />

            <div className="flex justify-end border-t border-border/50 pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={handleSkip}
                disabled={remaining <= 1}
              >
                <SkipForward className="h-4 w-4" />
                {t("review.skip")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
