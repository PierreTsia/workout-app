import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useExerciseById } from "@/hooks/useExerciseById"
import { useAdminUpdateExercise } from "@/hooks/useAdminUpdateExercise"
import { Badge } from "@/components/ui/badge"
import { ExerciseEditForm } from "@/components/admin/exercise-form/ExerciseEditForm"
import { ExerciseReviewToolbar } from "@/components/admin/review/ExerciseReviewToolbar"
import { fromFormValues } from "@/components/admin/exercise-form/transforms"
import type { ExerciseFormValues } from "@/components/admin/exercise-form/schema"

export function AdminExerciseEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation("admin")
  const { data: exercise, isLoading } = useExerciseById(id ?? null)
  const mutation = useAdminUpdateExercise(id ?? "")

  function handleSubmit(values: ExerciseFormValues) {
    const payload = fromFormValues(values)
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t("toast.saveSuccess"))
        navigate("/admin/exercises")
      },
      onError: () => {
        toast.error(t("toast.saveError"))
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Exercise not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <Link
          to="/admin/exercises"
          className="flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("backToList")}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            {exercise.emoji} {exercise.name}
          </h1>
          {exercise.reviewed_at ? (
            <Badge variant="default" className="bg-green-600 text-xs">
              {t("reviewed")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {t("notReviewed")}
            </Badge>
          )}
        </div>
      </div>

      <ExerciseReviewToolbar exercise={exercise} />

      <ExerciseEditForm
        exercise={exercise}
        onSubmit={handleSubmit}
        isPending={mutation.isPending}
      />
    </div>
  )
}
