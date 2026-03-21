import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { EllipsisVertical, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExerciseSwapPicker } from "@/components/generator/ExerciseSwapPicker"
import { ExerciseDetailSheet } from "@/components/generator/ExerciseDetailSheet"
import { SwapExerciseSheet } from "@/components/workout/SwapExerciseSheet"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import type { Exercise, WorkoutExercise } from "@/types/database"

export interface PreSessionExerciseListProps {
  exercises: WorkoutExercise[]
  exercisePool: Exercise[]
  poolLoading: boolean
  onSwapExerciseChosen: (row: WorkoutExercise, picked: Exercise) => void
  onDeleteRequested: (row: WorkoutExercise) => void
  onAddExerciseChosen: (picked: Exercise) => void
}

export function PreSessionExerciseList({
  exercises,
  exercisePool,
  poolLoading,
  onSwapExerciseChosen,
  onDeleteRequested,
  onAddExerciseChosen,
}: PreSessionExerciseListProps) {
  const { t } = useTranslation("workout")
  const { formatWeight } = useWeightUnit()
  const [swappingRowId, setSwappingRowId] = useState<string | null>(null)
  const [swapSheetRowId, setSwapSheetRowId] = useState<string | null>(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [inspectedExerciseId, setInspectedExerciseId] = useState<string | null>(null)

  const currentExerciseIds = exercises.map((e) => e.exercise_id)
  const swapSheetRow = exercises.find((e) => e.id === swapSheetRowId) ?? null

  const poolById = useMemo(() => {
    const m = new Map<string, Exercise>()
    for (const e of exercisePool) m.set(e.id, e)
    return m
  }, [exercisePool])

  const inspectedExercise = inspectedExerciseId
    ? poolById.get(inspectedExerciseId) ?? null
    : null

  return (
    <div className="space-y-2">
      {exercises.map((ex) => (
        <div key={ex.id} className="space-y-1">
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
                <DropdownMenuItem
                  onClick={() => setInspectedExerciseId(ex.exercise_id)}
                >
                  {t("preSession.details")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setSwappingRowId((id) => (id === ex.id ? null : ex.id))
                  }
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
          </div>

          {swappingRowId === ex.id && (
            <div className="pl-1">
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
                      setSwappingRowId(null)
                    }}
                    onClose={() => setSwappingRowId(null)}
                  />
                </TabsContent>
                <TabsContent value="all">
                  <div className="rounded-lg border bg-card p-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSwapSheetRowId(ex.id)
                      }}
                    >
                      {t("preSession.swapBrowseLibrary")}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={() => setAddSheetOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {t("preSession.addExercise")}
      </Button>

      <SwapExerciseSheet
        open={!!swapSheetRow}
        onOpenChange={(open) => {
          if (!open) setSwapSheetRowId(null)
        }}
        currentExerciseIds={currentExerciseIds}
        onSelect={(picked) => {
          if (swapSheetRow) {
            onSwapExerciseChosen(swapSheetRow, picked)
            setSwappingRowId(null)
            setSwapSheetRowId(null)
          }
        }}
      />

      <SwapExerciseSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        currentExerciseIds={currentExerciseIds}
        title={t("preSession.addExercise")}
        onSelect={(picked) => {
          onAddExerciseChosen(picked)
          setAddSheetOpen(false)
        }}
      />

      <ExerciseDetailSheet
        exercise={inspectedExercise}
        open={!!inspectedExercise}
        onOpenChange={(v) => {
          if (!v) setInspectedExerciseId(null)
        }}
      />
    </div>
  )
}
