import { useState } from "react"
import { Activity, AlertTriangle, ChevronDown, Settings2, Wind } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import { getExerciseImageUrl } from "@/lib/storage"
import { InstructionSection } from "./InstructionSection"
import { YouTubeLink } from "./YouTubeLink"

interface ExerciseInstructionsPanelProps {
  exerciseId: string
}

export function ExerciseInstructionsPanel({
  exerciseId,
}: ExerciseInstructionsPanelProps) {
  const { t } = useTranslation("exercise")
  const { data: exercise, isLoading } = useExerciseFromLibrary(exerciseId)
  const [expanded, setExpanded] = useState(false)
  const [imageError, setImageError] = useState(false)

  if (isLoading) return null

  const hasInstructions =
    exercise?.instructions &&
    (exercise.instructions.setup.length > 0 ||
      exercise.instructions.movement.length > 0 ||
      exercise.instructions.breathing.length > 0 ||
      exercise.instructions.common_mistakes.length > 0)

  const hasContent =
    hasInstructions || exercise?.image_url || exercise?.youtube_url

  if (!hasContent) return null

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/50">
        <span className="flex-1 text-sm font-medium">{t("howToPerform")}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="flex flex-col gap-4 px-3 pb-2 pt-1">
        {exercise?.image_url && !imageError && (
          <img
            src={getExerciseImageUrl(exercise.image_url)}
            alt=""
            loading="lazy"
            className="w-full rounded-lg object-cover aspect-video"
            onError={() => setImageError(true)}
          />
        )}

        {exercise?.instructions && (
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

        {exercise?.youtube_url && <YouTubeLink url={exercise.youtube_url} />}
      </CollapsibleContent>
    </Collapsible>
  )
}
