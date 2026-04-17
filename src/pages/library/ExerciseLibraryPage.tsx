import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react"
import { useExerciseLibraryPaginated } from "@/hooks/useExerciseLibraryPaginated"
import { useExerciseFilterOptions } from "@/hooks/useExerciseFilterOptions"
import type { Exercise } from "@/types/database"
import { ExerciseFilterPanel } from "@/components/builder/ExerciseFilterPanel"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { Badge } from "@/components/ui/badge"
import { getDifficultyColor } from "@/lib/difficulty"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 300

export function ExerciseLibraryPage() {
  const { t } = useTranslation("library")
  const { t: tBuilder } = useTranslation("builder")
  const navigate = useNavigate()

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
    enabled: true,
  })

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

  const openExercise = useCallback(
    (id: string) => {
      navigate(`/library/exercises/${id}`)
    },
    [navigate],
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/library/programs")}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("exerciseBrowseBack")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{t("exerciseBrowseTitle")}</h1>
      </div>

      <Command className="flex min-h-0 flex-1 flex-col rounded-none border-0 bg-transparent" shouldFilter={false}>
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

        <CommandList className="min-h-0 flex-1 max-h-none overflow-x-hidden overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <CommandEmpty>{tBuilder("noExercisesFound")}</CommandEmpty>
              {grouped &&
                Object.entries(grouped).map(([muscle, exList]) => (
                  <CommandGroup key={muscle} heading={muscle}>
                    {exList.map((ex) => (
                      <CommandItem
                        key={ex.id}
                        value={ex.id}
                        onSelect={() => openExercise(ex.id)}
                        className="cursor-pointer rounded-lg py-3 aria-selected:bg-muted/50"
                      >
                        <ExerciseThumbnail
                          imageUrl={ex.image_url}
                          emoji={ex.emoji}
                          className="mr-3 h-16 w-16 shrink-0 rounded-lg"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="truncate font-medium">{ex.name}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="w-fit text-xs font-normal">
                              {ex.equipment}
                            </Badge>
                            {ex.difficulty_level && (
                              <Badge
                                className={cn(
                                  "w-fit text-xs font-normal border-0",
                                  getDifficultyColor(ex.difficulty_level),
                                )}
                              >
                                {tBuilder(`difficulty.${ex.difficulty_level}`, ex.difficulty_level)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
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
            </>
          )}
        </CommandList>
      </Command>
    </div>
  )
}
