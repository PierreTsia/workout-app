import { useMemo, useState, useCallback } from "react"
import { Loader2, SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useExerciseLibrary } from "@/hooks/useExerciseLibrary"
import {
  useAddExercisesToDay,
  useDeleteExercise,
} from "@/hooks/useBuilderMutations"
import type { Exercise } from "@/types/database"
import { ExerciseFilterPanel } from "@/components/builder/ExerciseFilterPanel"
import { ExerciseSelectionContent } from "@/components/builder/ExerciseSelectionContent"
import type { ExistingDayExercise } from "@/components/builder/ExerciseSelectionContent"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Command,
  CommandInput,
  CommandList,
} from "@/components/ui/command"

export type { ExistingDayExercise }

interface ExerciseLibraryPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dayId: string
  existingExerciseCount: number
  /** Exercises already in this day (pre-checked; uncheck to remove) */
  existingExercises?: ExistingDayExercise[]
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

export function ExerciseLibraryPicker({
  open,
  onOpenChange,
  dayId,
  existingExerciseCount,
  existingExercises = [],
  onMutationStateChange,
}: ExerciseLibraryPickerProps) {
  const { t } = useTranslation("builder")
  const { data: exercises, isLoading } = useExerciseLibrary()
  const addExercises = useAddExercisesToDay()
  const deleteExercise = useDeleteExercise()

  const existingSet = useMemo(
    () => new Set(existingExercises.map((e) => e.exercise_id)),
    [existingExercises],
  )

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(
    null,
  )
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])

  const activeFilterCount =
    (selectedMuscleGroup ? 1 : 0) + selectedEquipment.length

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setFiltersOpen(false)
        setSelectedMuscleGroup(null)
        setSelectedEquipment([])
      }
      onOpenChange(next)
    },
    [onOpenChange],
  )

  const muscleGroups = useMemo(
    () => [...new Set(exercises?.map((e) => e.muscle_group) ?? [])].sort(),
    [exercises],
  )

  const equipmentTypes = useMemo(
    () => [...new Set(exercises?.map((e) => e.equipment) ?? [])].sort(),
    [exercises],
  )

  const filtered =
    exercises === undefined
      ? undefined
      : exercises.filter((ex) => {
          if (selectedMuscleGroup && ex.muscle_group !== selectedMuscleGroup)
            return false
          if (
            selectedEquipment.length > 0 &&
            !selectedEquipment.includes(ex.equipment)
          )
            return false
          return true
        })

  const grouped = filtered?.reduce<Record<string, Exercise[]>>((acc, ex) => {
    const group = ex.muscle_group
    if (!acc[group]) acc[group] = []
    acc[group].push(ex)
    return acc
  }, {})

  const selectionKey = open
    ? [...existingSet].sort().join(",")
    : "closed"

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          "flex max-h-[75vh] flex-col gap-0 p-0 sm:max-h-[80vh]",
          "xl:left-1/2 xl:right-auto xl:max-w-2xl xl:-translate-x-1/2",
        )}
      >
        <SheetHeader className="shrink-0 px-4 pt-4">
          <SheetTitle>{t("addExercise")}</SheetTitle>
        </SheetHeader>

        <Command className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center border-b pr-2 [&_[cmdk-input-wrapper]]:min-w-0 [&_[cmdk-input-wrapper]]:flex-1 [&_[cmdk-input-wrapper]]:border-0">
            <CommandInput placeholder={t("searchExercises")} />
            <button
              type="button"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="relative flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={t("filters")}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div
            className={cn(
              "grid shrink-0 transition-[grid-template-rows] duration-200",
              filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              {filtersOpen && (
                <ExerciseFilterPanel
                  muscleGroups={muscleGroups}
                  equipmentTypes={equipmentTypes}
                  selectedMuscleGroup={selectedMuscleGroup}
                  selectedEquipment={selectedEquipment}
                  onMuscleGroupChange={setSelectedMuscleGroup}
                  onEquipmentChange={setSelectedEquipment}
                />
              )}
            </div>
          </div>

          <CommandList className="min-h-0 flex-1 max-h-none overflow-x-hidden overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ExerciseSelectionContent
                key={selectionKey}
                initialSelectedIds={existingExercises.map((e) => e.exercise_id)}
                existingExercises={existingExercises}
                existingSet={existingSet}
                filtered={filtered}
                grouped={grouped}
                dayId={dayId}
                existingExerciseCount={existingExerciseCount}
                onMutationStateChange={onMutationStateChange}
                onClose={() => handleOpenChange(false)}
                addExercises={addExercises}
                deleteExercise={deleteExercise}
              />
            )}
          </CommandList>
        </Command>
      </SheetContent>
    </Sheet>
  )
}
