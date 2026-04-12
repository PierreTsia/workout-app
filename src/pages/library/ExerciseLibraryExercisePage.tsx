import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import { ExerciseInstructionsPanel } from "@/components/exercise/ExerciseInstructionsPanel"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { AddExerciseToDaySheet } from "@/components/library/AddExerciseToDaySheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidExerciseId(id: string | undefined): boolean {
  return Boolean(id && UUID_RE.test(id))
}

export function ExerciseLibraryExercisePage() {
  const { t } = useTranslation("library")
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const [addOpen, setAddOpen] = useState(false)

  const valid = isValidExerciseId(exerciseId)
  const { data: exercise, isLoading } = useExerciseFromLibrary(
    valid && exerciseId ? exerciseId : "",
  )

  if (!valid) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-8 pt-6 text-center">
        <p className="text-muted-foreground">{t("exerciseNotFound")}</p>
        <Button asChild variant="secondary">
          <Link to="/library/exercises">{t("exerciseBrowseBackToList")}</Link>
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12 text-muted-foreground">
        {t("exerciseDetailLoading")}
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-8 pt-6 text-center">
        <p className="text-muted-foreground">{t("exerciseNotFound")}</p>
        <Button asChild variant="secondary">
          <Link to="/library/exercises">{t("exerciseBrowseBackToList")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-8">
        <div className="flex items-center gap-3 pt-1">
          <Link
            to="/library/exercises"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t("exerciseBrowseBack")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight">{exercise.name}</h1>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <ExerciseThumbnail
              imageUrl={exercise.image_url}
              emoji={exercise.emoji}
              className="h-16 w-16 shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Badge variant="default" className="w-fit text-xs font-normal">
                {exercise.muscle_group}
              </Badge>
              <Badge variant="secondary" className="w-fit text-xs font-normal">
                {exercise.equipment}
              </Badge>
              {exercise.difficulty_level && (
                <Badge variant="outline" className="w-fit text-xs font-normal">
                  {exercise.difficulty_level}
                </Badge>
              )}
            </div>
          </div>

          <ExerciseInstructionsPanel exerciseId={exercise.id} defaultExpanded />

          <Button type="button" className="w-full" size="lg" onClick={() => setAddOpen(true)}>
            {t("addToSessionCta")}
          </Button>
        </div>
      </div>

      <AddExerciseToDaySheet exercise={exercise} open={addOpen} onOpenChange={setAddOpen} />
    </>
  )
}
