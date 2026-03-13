import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useExerciseById } from "@/hooks/useExerciseById"
import { useAdminUpdateExercise } from "@/hooks/useAdminUpdateExercise"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExerciseEditForm } from "@/components/admin/exercise-form/ExerciseEditForm"
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to="/admin/exercises">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{t("editExercise")}</h1>
          <p className="text-sm text-muted-foreground">
            {exercise.emoji} {exercise.name}
          </p>
        </div>
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

      <ExerciseEditForm
        exercise={exercise}
        onSubmit={handleSubmit}
        isPending={mutation.isPending}
      />
    </div>
  )
}
