import { useState } from "react"
import { Activity, AlertTriangle, Info, Settings2, Wind } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Exercise } from "@/types/database"
import { getExerciseImageUrl } from "@/lib/storage"
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
  const [imageError, setImageError] = useState(false)

  const hasInstructions =
    exercise.instructions &&
    (exercise.instructions.setup.length > 0 ||
      exercise.instructions.movement.length > 0 ||
      exercise.instructions.breathing.length > 0 ||
      exercise.instructions.common_mistakes.length > 0)

  const hasContent =
    hasInstructions || exercise.image_url || exercise.youtube_url

  if (!hasContent) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Info className="h-4 w-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="mr-2">{exercise.emoji}</span>
            {exercise.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("howToPerform")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {exercise.image_url && !imageError && (
            <img
              src={getExerciseImageUrl(exercise.image_url)}
              alt=""
              loading="lazy"
              className="w-full rounded-lg object-cover aspect-video"
              onError={() => setImageError(true)}
            />
          )}

          {exercise.instructions && (
            <>
              <InstructionSection
                icon={Settings2}
                title={t("setup")}
                items={exercise.instructions.setup}
              />
              <InstructionSection
                icon={Activity}
                title={t("movement")}
                items={exercise.instructions.movement}
              />
              <InstructionSection
                icon={Wind}
                title={t("breathing")}
                items={exercise.instructions.breathing}
              />
              <InstructionSection
                icon={AlertTriangle}
                title={t("commonMistakes")}
                items={exercise.instructions.common_mistakes}
              />
            </>
          )}

          {exercise.youtube_url && <YouTubeLink url={exercise.youtube_url} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
