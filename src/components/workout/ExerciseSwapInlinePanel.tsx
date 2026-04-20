import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExerciseSwapPicker } from "@/components/generator/ExerciseSwapPicker"
import type { ExerciseListItem, WorkoutExercise } from "@/types/database"

export interface ExerciseSwapInlinePanelProps {
  exercise: WorkoutExercise
  exercisePool: ExerciseListItem[]
  currentExerciseIds: string[]
  onSwapExerciseChosen: (row: WorkoutExercise, picked: ExerciseListItem) => void
  onSwapBrowseLibrary: (row: WorkoutExercise) => void
  onDismiss: () => void
  /** Extra class on outer wrapper (e.g. pre-session list indent). */
  className?: string
}

export function ExerciseSwapInlinePanel({
  exercise: ex,
  exercisePool,
  currentExerciseIds,
  onSwapExerciseChosen,
  onSwapBrowseLibrary,
  onDismiss,
  className = "",
}: ExerciseSwapInlinePanelProps) {
  const { t } = useTranslation("workout")
  const { t: tCommon } = useTranslation("common")

  return (
    <div className={className}>
      <Tabs defaultValue="same-muscle" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="same-muscle" className="flex-1 text-xs">
            {t("preSession.swapSameMuscle")}
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1 text-xs">
            {t("preSession.swapAllExercises")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="same-muscle">
          <ExerciseSwapPicker
            pool={exercisePool}
            currentExerciseIds={currentExerciseIds}
            muscleGroup={ex.muscle_snapshot}
            onSelect={(picked) => {
              onSwapExerciseChosen(ex, picked)
              onDismiss()
            }}
            onClose={onDismiss}
          />
        </TabsContent>
        <TabsContent value="all">
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onSwapBrowseLibrary(ex)}
            >
              {t("preSession.swapBrowseLibrary")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={onDismiss}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
