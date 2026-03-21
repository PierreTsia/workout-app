import { useState } from "react"
import { useTranslation } from "react-i18next"
import { EllipsisVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExerciseSwapPicker } from "@/components/generator/ExerciseSwapPicker"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import type { Exercise, WorkoutExercise } from "@/types/database"

export type ExerciseEditRowControlsLayout = "listRow" | "detail"

export interface ExerciseEditRowControlsProps {
  exercise: WorkoutExercise
  exercisePool: Exercise[]
  poolLoading: boolean
  currentExerciseIds: string[]
  layout: ExerciseEditRowControlsLayout
  onSwapExerciseChosen: (row: WorkoutExercise, picked: Exercise) => void
  onDeleteRequested: (row: WorkoutExercise) => void
  onSwapBrowseLibrary: (row: WorkoutExercise) => void
  onInspectDetails: (exerciseId: string) => void
}

export function ExerciseEditRowControls({
  exercise: ex,
  exercisePool,
  poolLoading,
  currentExerciseIds,
  layout,
  onSwapExerciseChosen,
  onDeleteRequested,
  onSwapBrowseLibrary,
  onInspectDetails,
}: ExerciseEditRowControlsProps) {
  const { t } = useTranslation("workout")
  const { formatWeight } = useWeightUnit()
  const [swapPanelOpen, setSwapPanelOpen] = useState(false)

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={poolLoading}
          aria-label={t("preSession.rowActionsLabel")}
        >
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onInspectDetails(ex.exercise_id)}>
          {t("preSession.details")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setSwapPanelOpen((v) => !v)}
        >
          {t("preSession.swap")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDeleteRequested(ex)}
        >
          {t("preSession.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const swapPanel =
    swapPanelOpen && (
      <div className={layout === "listRow" ? "pl-1" : ""}>
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
                setSwapPanelOpen(false)
              }}
              onClose={() => setSwapPanelOpen(false)}
            />
          </TabsContent>
          <TabsContent value="all">
            <div className="rounded-lg border bg-card p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onSwapBrowseLibrary(ex)}
              >
                {t("preSession.swapBrowseLibrary")}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    )

  if (layout === "detail") {
    return (
      <div className="w-full space-y-2">
        <div className="flex justify-end">{menu}</div>
        {swapPanel}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
        <span className="text-2xl leading-none">{ex.emoji_snapshot}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {ex.name_snapshot}
          </p>
          <p className="text-xs text-muted-foreground">
            {ex.sets} × {ex.reps}
            {Number(ex.weight) > 0 && ` · ${formatWeight(Number(ex.weight))}`}
          </p>
        </div>
        {menu}
      </div>
      {swapPanel}
    </div>
  )
}
