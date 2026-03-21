import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react"
import { useExerciseLibraryPaginated } from "@/hooks/useExerciseLibraryPaginated"
import { useExerciseFilterOptions } from "@/hooks/useExerciseFilterOptions"
import { ExerciseFilterPanel } from "@/components/builder/ExerciseFilterPanel"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Exercise } from "@/types/database"

const SEARCH_DEBOUNCE_MS = 300

interface SwapExerciseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentExerciseIds: string[]
  onSelect: (exercise: Exercise) => void
  title?: string
}

export function SwapExerciseSheet({
  open,
  onOpenChange,
  currentExerciseIds,
  onSelect,
  title,
}: SwapExerciseSheetProps) {
  const { t } = useTranslation("workout")
  const { t: tBuilder } = useTranslation("builder")

  const [searchInput, setSearchInput] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>([])

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [searchInput])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setSearchInput("")
        setSearchDebounced("")
        setFiltersOpen(false)
        setSelectedMuscleGroup(null)
        setSelectedEquipment([])
        setSelectedDifficulty([])
      }
      onOpenChange(next)
    },
    [onOpenChange],
  )

  const { data: filterOptions } = useExerciseFilterOptions()
  const muscleGroups = useMemo(() => filterOptions?.muscle_groups ?? [], [filterOptions?.muscle_groups])
  const equipmentTypes = useMemo(() => filterOptions?.equipment ?? [], [filterOptions?.equipment])
  const difficultyLevels = useMemo(() => filterOptions?.difficulty_levels ?? [], [filterOptions?.difficulty_levels])

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

  const excludeSet = useMemo(() => new Set(currentExerciseIds), [currentExerciseIds])

  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>()
    for (const ex of paginatedData ?? []) {
      if (excludeSet.has(ex.id)) continue
      const list = map.get(ex.muscle_group) ?? []
      list.push(ex)
      map.set(ex.muscle_group, list)
    }
    return map
  }, [paginatedData, excludeSet])

  const activeFilterCount =
    (selectedMuscleGroup ? 1 : 0) + selectedEquipment.length + selectedDifficulty.length

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
          <SheetTitle>{title ?? t("preSession.swapSheetTitle")}</SheetTitle>
        </SheetHeader>

        <div className="flex shrink-0 items-center border-b px-3 pr-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
          <Input
            type="search"
            placeholder={tBuilder("searchExercises")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-11 flex-1 min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label={tBuilder("searchExercises")}
          />
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="relative flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={tBuilder("filters")}
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : grouped.size === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("preSession.noResults")}
            </p>
          ) : (
            <div className="flex flex-col gap-1 px-3 pb-4 pt-2">
              {[...grouped.entries()].map(([group, exercises]) => (
                <div key={group}>
                  <span className="sticky top-0 z-10 block bg-background px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </span>
                  {exercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => {
                        onSelect(exercise)
                        handleOpenChange(false)
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <ExerciseThumbnail
                        imageUrl={exercise.image_url}
                        emoji={exercise.emoji}
                        className="h-7 w-7 rounded"
                      />
                      <span className="truncate">{exercise.name}</span>
                    </button>
                  ))}
                </div>
              ))}

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
                    {tBuilder("loadMore")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
