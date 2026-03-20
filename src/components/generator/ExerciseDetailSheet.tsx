import { useTranslation } from "react-i18next"
import { Activity, Settings2, Wind, AlertTriangle } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { InstructionSection } from "@/components/exercise/InstructionSection"
import { getYouTubeEmbedUrl } from "@/lib/youtube"
import { BodyMap } from "@/components/body-map/BodyMap"
import type { Exercise } from "@/types/database"

interface ExerciseDetailSheetProps {
  exercise: Exercise | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExerciseDetailSheet({
  exercise,
  open,
  onOpenChange,
}: ExerciseDetailSheetProps) {
  const { t } = useTranslation("exercise")

  if (!exercise) return null

  const ins = exercise.instructions

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader className="gap-3">
          <ExerciseThumbnail
            imageUrl={exercise.image_url}
            emoji={exercise.emoji}
            className="h-48 w-full rounded-md"
          />
          <SheetTitle className="flex items-center gap-2">
            <span className="text-xl">{exercise.emoji}</span>
            {exercise.name}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {exercise.muscle_group}
            </span>
            {exercise.equipment && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {exercise.equipment}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <BodyMap
          muscleGroup={exercise.muscle_group}
          secondaryMuscles={exercise.secondary_muscles}
          className="mt-4"
        />

        <div className="mt-4 flex flex-col gap-4">
          {ins && (
            <>
              <InstructionSection
                icon={Settings2}
                title={t("setup")}
                items={ins.setup}
              />
              <InstructionSection
                icon={Activity}
                title={t("movement")}
                items={ins.movement}
              />
              <InstructionSection
                icon={Wind}
                title={t("breathing")}
                items={ins.breathing}
              />
              <InstructionSection
                icon={AlertTriangle}
                title={t("commonMistakes")}
                items={ins.common_mistakes}
              />
            </>
          )}

          {exercise.youtube_url && (() => {
            const embedUrl = getYouTubeEmbedUrl(exercise.youtube_url!)
            if (!embedUrl) return null
            return (
              <div
                className="relative aspect-video w-full overflow-hidden rounded-lg"
                style={{ touchAction: "auto" }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <iframe
                  src={embedUrl}
                  title={exercise.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                  style={{ touchAction: "auto", pointerEvents: "auto" }}
                />
              </div>
            )
          })()}
        </div>
      </SheetContent>
    </Sheet>
  )
}
