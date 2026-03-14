import { useMemo, useState, useCallback, useEffect } from "react"
import { Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useExerciseLibraryPaginated } from "@/hooks/useExerciseLibraryPaginated"
import { useExerciseFilterOptions } from "@/hooks/useExerciseFilterOptions"
import {
  useAddExercisesToDay,
  useDeleteExercise,
} from "@/hooks/useBuilderMutations"
import type { Exercise } from "@/types/database"
import { ExerciseFilterPanel } from "@/components/builder/ExerciseFilterPanel"
import { ExerciseSelectionContent } from "@/components/builder/ExerciseSelectionContent"
import type { ExistingDayExercise } from "@/components/builder/ExerciseSelectionContent"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Command, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"

const SEARCH_DEBOUNCE_MS = 300

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
  const addExercises = useAddExercisesToDay()
  const deleteExercise = useDeleteExercise()

  const [searchInput, setSearchInput] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(
    null,
  )
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>([])

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [searchInput])

  const { data: filterOptions } = useExerciseFilterOptions()
  const muscleGroups = useMemo(
    () => filterOptions?.muscle_groups ?? [],
    [filterOptions?.muscle_groups],
  )
  const equipmentTypes = useMemo(
    () => filterOptions?.equipment ?? [],
    [filterOptions?.equipment],
  )
  const difficultyLevels = useMemo(
    () => filterOptions?.difficulty_levels ?? [],
    [filterOptions?.difficulty_levels],
  )

  const {
    data: paginatedData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useExerciseLibraryPaginated({
    search: searchDebounced,
    muscleGroup: selectedMuscleGroup,
    equipment: selectedEquipment,
    difficulty: selectedDifficulty,
    enabled: open,
  })

  const existingSet = useMemo(
    () => new Set(existingExercises.map((e) => e.exercise_id)),
    [existingExercises],
  )

  const grouped = useMemo(
    () =>
      (paginatedData ?? []).reduce<Record<string, Exercise[]>>((acc, ex) => {
        const group = ex.muscle_group
        if (!acc[group]) acc[group] = []
        acc[group].push(ex)
        return acc
      }, {}),
    [paginatedData],
  )

  const activeFilterCount =
    (selectedMuscleGroup ? 1 : 0) +
    selectedEquipment.length +
    selectedDifficulty.length

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setSearchInput("")
        setSearchDebounced("")
      } else {
        setFiltersOpen(false)
        setSelectedMuscleGroup(null)
        setSelectedEquipment([])
        setSelectedDifficulty([])
        setSearchInput("")
      }
      onOpenChange(next)
    },
    [onOpenChange],
  )

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

        <Command
          className="flex min-h-0 flex-1 flex-col"
          shouldFilter={false}
        >
          <div className="flex shrink-0 items-center border-b px-3 pr-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("searchExercises")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-11 flex-1 min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label={t("searchExercises")}
            />
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
                  difficultyLevels={difficultyLevels}
                  selectedMuscleGroup={selectedMuscleGroup}
                  selectedEquipment={selectedEquipment}
                  selectedDifficulty={selectedDifficulty}
                  onMuscleGroupChange={setSelectedMuscleGroup}
                  onEquipmentChange={setSelectedEquipment}
                  onDifficultyChange={setSelectedDifficulty}
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
              <>
                <ExerciseSelectionContent
                  key={selectionKey}
                  initialSelectedIds={existingExercises.map((e) => e.exercise_id)}
                  existingExercises={existingExercises}
                  existingSet={existingSet}
                  filtered={paginatedData}
                  grouped={grouped}
                  dayId={dayId}
                  existingExerciseCount={existingExerciseCount}
                  onMutationStateChange={onMutationStateChange}
                  onClose={() => handleOpenChange(false)}
                  addExercises={addExercises}
                  deleteExercise={deleteExercise}
                />
                {hasNextPage && (
                  <div className="flex justify-center border-t py-3">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {t("loadMore")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </SheetContent>
    </Sheet>
  )
}
