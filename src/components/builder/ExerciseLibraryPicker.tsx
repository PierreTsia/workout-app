import { useMemo, useState } from "react"
import { Loader2, SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useExerciseLibrary } from "@/hooks/useExerciseLibrary"
import { useAddExerciseToDay } from "@/hooks/useBuilderMutations"
import type { Exercise } from "@/types/database"
import { ExerciseInfoDialog } from "@/components/exercise/ExerciseInfoDialog"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { ExerciseFilterPanel } from "@/components/builder/ExerciseFilterPanel"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

interface ExerciseLibraryPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dayId: string
  existingExerciseCount: number
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

export function ExerciseLibraryPicker({
  open,
  onOpenChange,
  dayId,
  existingExerciseCount,
  onMutationStateChange,
}: ExerciseLibraryPickerProps) {
  const { t } = useTranslation("builder")
  const { data: exercises, isLoading } = useExerciseLibrary()
  const addExercise = useAddExerciseToDay()

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])

  const activeFilterCount =
    (selectedMuscleGroup ? 1 : 0) + selectedEquipment.length

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFiltersOpen(false)
      setSelectedMuscleGroup(null)
      setSelectedEquipment([])
    }
    onOpenChange(next)
  }

  function handleSelect(exercise: Exercise) {
    onMutationStateChange("saving")
    addExercise.mutate(
      { dayId, exercise, sortOrder: existingExerciseCount },
      {
        onSuccess: () => {
          onMutationStateChange("saved")
          handleOpenChange(false)
        },
        onError: () => onMutationStateChange("error"),
      },
    )
  }

  const muscleGroups = useMemo(
    () => [...new Set(exercises?.map((e) => e.muscle_group) ?? [])].sort(),
    [exercises],
  )

  const equipmentTypes = useMemo(
    () => [...new Set(exercises?.map((e) => e.equipment) ?? [])].sort(),
    [exercises],
  )

  const filtered = useMemo(() => {
    if (!exercises) return undefined
    return exercises.filter((ex) => {
      if (selectedMuscleGroup && ex.muscle_group !== selectedMuscleGroup)
        return false
      if (
        selectedEquipment.length > 0 &&
        !selectedEquipment.includes(ex.equipment)
      )
        return false
      return true
    })
  }, [exercises, selectedMuscleGroup, selectedEquipment])

  const grouped = useMemo(
    () =>
      filtered?.reduce<Record<string, Exercise[]>>((acc, ex) => {
        const group = ex.muscle_group
        if (!acc[group]) acc[group] = []
        acc[group].push(ex)
        return acc
      }, {}),
    [filtered],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{t("addExercise")}</DialogTitle>
        </DialogHeader>

        <Command className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center border-b pr-2 [&_[cmdk-input-wrapper]]:flex-1 [&_[cmdk-input-wrapper]]:border-0">
            <CommandInput placeholder={t("searchExercises")} />
            <button
              type="button"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="relative shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
              "grid transition-[grid-template-rows] duration-200",
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

          <CommandList className="min-h-0 flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>{t("noExercisesFound")}</CommandEmpty>
                {grouped &&
                  Object.entries(grouped).map(([muscle, exList]) => (
                    <CommandGroup key={muscle} heading={muscle}>
                      {exList.map((ex) => (
                        <CommandItem
                          key={ex.id}
                          value={`${ex.name} ${ex.name_en ?? ""} ${ex.muscle_group}`}
                          onSelect={() => handleSelect(ex)}
                          disabled={addExercise.isPending}
                          className="flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2.5">
                            <ExerciseThumbnail imageUrl={ex.image_url} emoji={ex.emoji} className="h-8 w-8 rounded-md" />
                            <span>{ex.name}</span>
                          </span>
                          <ExerciseInfoDialog exercise={ex} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
