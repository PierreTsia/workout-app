import { Activity, AlertTriangle, Info, Pencil, Settings2, Wind } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import type { Exercise } from "@/types/database"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { AdminOnly } from "@/components/admin/AdminOnly"
import { ExerciseThumbnail } from "./ExerciseThumbnail"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { InstructionSection } from "./InstructionSection"
import { YouTubeLink } from "./YouTubeLink"

interface ExerciseInfoDialogProps {
  exercise: Exercise
}

export function ExerciseInfoDialog({ exercise }: ExerciseInfoDialogProps) {
  const { t } = useTranslation("exercise")
  const { catalogName, exerciseInstructions } = useCatalogLabels()

  const instructions = exerciseInstructions(exercise)
  const hasContent = instructions || exercise.youtube_url

  if (!hasContent) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("instructionsFor", { name: catalogName(exercise) })}
          className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Info className="h-4 w-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExerciseThumbnail imageUrl={exercise.image_url} emoji={exercise.emoji} className="h-8 w-8" />
            {catalogName(exercise)}
            <AdminOnly>
              <Link
                to={`/admin/exercises/${exercise.id}`}
                className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </AdminOnly>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("howToPerform")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {instructions && (
            <>
              <InstructionSection
                icon={Settings2}
                title={t("setup")}
                items={instructions.setup}
              />
              <InstructionSection
                icon={Activity}
                title={t("movement")}
                items={instructions.movement}
              />
              <InstructionSection
                icon={Wind}
                title={t("breathing")}
                items={instructions.breathing}
              />
              <InstructionSection
                icon={AlertTriangle}
                title={t("commonMistakes")}
                items={instructions.common_mistakes}
              />
            </>
          )}

          {exercise.youtube_url && <YouTubeLink url={exercise.youtube_url} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
