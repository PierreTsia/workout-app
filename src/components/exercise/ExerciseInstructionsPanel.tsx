import { useState } from "react"
import { Activity, AlertTriangle, BookOpen, ChevronDown, Settings2, Wind } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import { InstructionSection } from "./InstructionSection"
import { YouTubeLink } from "./YouTubeLink"

interface ExerciseInstructionsPanelProps {
  exerciseId: string
  /** When true, instructions start expanded (e.g. library detail page). */
  defaultExpanded?: boolean
}

export function ExerciseInstructionsPanel({
  exerciseId,
  defaultExpanded = false,
}: ExerciseInstructionsPanelProps) {
  const { t } = useTranslation("exercise")
  const { exerciseInstructions } = useCatalogLabels()
  const { data: exercise, isLoading } = useExerciseFromLibrary(exerciseId)
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (isLoading) return null

  const instructions = exerciseInstructions(exercise)
  const hasContent = instructions || exercise?.youtube_url

  if (!hasContent) return null

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/50">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium">{t("howToPerform")}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="flex flex-col gap-4 px-3 pb-2 pt-1">
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

        {exercise?.youtube_url && <YouTubeLink url={exercise.youtube_url} />}
      </CollapsibleContent>
    </Collapsible>
  )
}
