import { useMemo, useState, useCallback, useEffect } from "react"
import { Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CircuitSeedCard } from "@/components/builder/CircuitSeedCard"
import { ExerciseFilterPanel } from "@/components/builder/ExerciseFilterPanel"
import {
  ExerciseSelectionList,
  ExerciseSelectionActions,
  useExerciseSelection,
} from "@/components/builder/ExerciseSelectionContent"
import type { ExistingDayExercise } from "@/components/builder/ExerciseSelectionContent"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useBenchmarkSeeds } from "@/hooks/useBenchmarkSeeds"
import {
  useAddExercisesToDay,
  useDeleteExercise,
} from "@/hooks/useBuilderMutations"
import { useExerciseFilterOptions } from "@/hooks/useExerciseFilterOptions"
import { useExerciseLibraryPaginated } from "@/hooks/useExerciseLibraryPaginated"
import { useInstantiateBenchmarkOnDay } from "@/hooks/useInstantiateBenchmarkOnDay"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import type { CatalogPreviewRow } from "@/lib/previewCatalogCircuit"
import { normalizeBenchmarkKey } from "@/lib/resolveBenchmark"
import { seedMatchesQuery } from "@/lib/seedSearch"
import { cn } from "@/lib/utils"
import type { Exercise } from "@/types/database"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Command, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"

const SEARCH_DEBOUNCE_MS = 300

function SeedCardList({
  seeds,
  pendingSeedId,
  onSelect,
}: {
  seeds: CatalogPreviewRow[]
  pendingSeedId: string | undefined
  onSelect: (seed: CatalogPreviewRow) => void
}) {
  return seeds.map((seed) => (
    <CircuitSeedCard
      key={seed.id}
      seed={seed}
      pending={pendingSeedId === seed.id}
      onSelect={() => onSelect(seed)}
    />
  ))
}

interface PickerSelectionPanelProps {
  selectionKey: string
  initialSelectedIds: string[]
  existingExercises: ExistingDayExercise[]
  existingSet: Set<string>
  grouped: Record<string, Exercise[]>
  dayId: string
  existingExerciseCount: number
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
  onClose: () => void
  addExercises: ReturnType<typeof useAddExercisesToDay>
  deleteExercise: ReturnType<typeof useDeleteExercise>
  onCreateBlock?: (selected: Exercise[]) => Promise<void> | void
  isLoading: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  pinnedSeeds: CatalogPreviewRow[]
  pendingSeedId: string | undefined
  onSelectSeed: (seed: CatalogPreviewRow) => void
}

function PickerSelectionPanel({
  selectionKey: _selectionKey,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  pinnedSeeds,
  pendingSeedId,
  onSelectSeed,
  ...selectionProps
}: PickerSelectionPanelProps) {
  const { t } = useTranslation("builder")
  const selection = useExerciseSelection(selectionProps)

  return (
    <>
      <CommandList className="min-h-0 flex-1 max-h-none overflow-x-hidden overflow-y-auto">
        {pinnedSeeds.length > 0 ? (
          <div className="flex flex-col gap-2 p-3 pb-1">
            <SeedCardList
              seeds={pinnedSeeds}
              pendingSeedId={pendingSeedId}
              onSelect={onSelectSeed}
            />
          </div>
        ) : null}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ExerciseSelectionList state={selection} />
            {hasNextPage && (
              <div className="flex justify-center border-t py-3">
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={onLoadMore}
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
      <ExerciseSelectionActions state={selection} />
    </>
  )
}

function CircuitsKindBody({
  isLoading,
  isError,
  seeds,
  pendingSeedId,
  onSelect,
}: {
  isLoading: boolean
  isError: boolean
  seeds: CatalogPreviewRow[]
  pendingSeedId: string | undefined
  onSelect: (seed: CatalogPreviewRow) => void
}) {
  const { t } = useTranslation("builder")

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="flex min-h-0 flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
        {t("circuitsError")}
      </p>
    )
  }

  if (seeds.length === 0) {
    return (
      <p className="flex min-h-0 flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
        {t("circuitsEmpty")}
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
      <SeedCardList
        seeds={seeds}
        pendingSeedId={pendingSeedId}
        onSelect={onSelect}
      />
    </div>
  )
}

export type { ExistingDayExercise }

interface ExerciseLibraryPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dayId: string
  existingExerciseCount: number
  /** Exercises already in this day (pre-checked; uncheck to remove) */
  existingExercises?: ExistingDayExercise[]
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
  /** When provided, the picker creates a block from the selected exercises instead of adding solos. */
  onCreateBlock?: (selected: Exercise[]) => Promise<void> | void
  /** Highest existing sort_order on the day. Presence gates the Circuits kind. */
  existingMaxSortOrder?: number
}

export function ExerciseLibraryPicker({
  open,
  onOpenChange,
  dayId,
  existingExerciseCount,
  existingExercises = [],
  onMutationStateChange,
  onCreateBlock,
  existingMaxSortOrder,
}: ExerciseLibraryPickerProps) {
  const { t } = useTranslation("builder")
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const addExercises = useAddExercisesToDay()
  const deleteExercise = useDeleteExercise()
  const canInstantiate = existingMaxSortOrder !== undefined && !onCreateBlock
  const instantiate = useInstantiateBenchmarkOnDay()

  const [kind, setKind] = useState<"exercises" | "circuits">("exercises")
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

  const seedsQuery = useBenchmarkSeeds(open && canInstantiate)
  const seeds = seedsQuery.data ?? []
  const queryIsActive = normalizeBenchmarkKey(searchInput).length >= 2
  const matchingSeeds = queryIsActive
    ? seeds.filter((seed) => seedMatchesQuery(seed, searchInput))
    : []
  const circuitsSeeds = queryIsActive ? matchingSeeds : seeds
  const pendingSeedId = instantiate.isPending
    ? instantiate.variables?.catalog.id
    : undefined

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
      setKind("exercises")
      setSearchInput("")
      if (next) {
        setSearchDebounced("")
      } else {
        setFiltersOpen(false)
        setSelectedMuscleGroup(null)
        setSelectedEquipment([])
        setSelectedDifficulty([])
      }
      onOpenChange(next)
    },
    [onOpenChange],
  )

  const selectionKey = open
    ? [...existingSet].sort().join(",")
    : "closed"

  const pickerTitle = onCreateBlock ? t("createBlock") : t("addExercise")
  const showCircuits = canInstantiate && kind === "circuits"

  const handleInstantiate = useCallback(
    async (seed: CatalogPreviewRow) => {
      if (existingMaxSortOrder === undefined) return
      onMutationStateChange("saving")
      try {
        await instantiate.mutateAsync({
          dayId,
          catalog: seed,
          existingMaxSortOrder,
        })
        onMutationStateChange("saved")
        handleOpenChange(false)
      } catch {
        toast.error(t("instantiateError"))
        onMutationStateChange("error")
      }
    },
    [
      dayId,
      existingMaxSortOrder,
      handleOpenChange,
      instantiate,
      onMutationStateChange,
      t,
    ],
  )

  const pickerBody = (
    <Command
      className="flex min-h-0 flex-1 flex-col"
      shouldFilter={false}
    >
      {canInstantiate ? (
        <ToggleGroup
          type="single"
          value={kind}
          onValueChange={(value) => {
            if (value === "exercises" || value === "circuits") {
              setKind(value)
            }
          }}
          variant="outline"
          className="grid w-full shrink-0 grid-cols-2 gap-0 px-3 pt-2"
        >
          <ToggleGroupItem
            value="exercises"
            className="rounded-r-none"
          >
            {t("kindExercises")}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="circuits"
            className="-ml-px rounded-l-none"
          >
            {t("kindCircuits")}
          </ToggleGroupItem>
        </ToggleGroup>
      ) : null}
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
        {showCircuits ? null : (
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
        )}
      </div>

      {showCircuits ? null : (
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
      )}

      {showCircuits ? (
        <CircuitsKindBody
          isLoading={seedsQuery.isLoading}
          isError={seedsQuery.isError}
          seeds={circuitsSeeds}
          pendingSeedId={pendingSeedId}
          onSelect={(seed) => {
            void handleInstantiate(seed)
          }}
        />
      ) : (
        <PickerSelectionPanel
          key={selectionKey}
          selectionKey={selectionKey}
          initialSelectedIds={existingExercises.map((e) => e.exercise_id)}
          existingExercises={existingExercises}
          existingSet={existingSet}
          grouped={grouped}
          dayId={dayId}
          existingExerciseCount={existingExerciseCount}
          onMutationStateChange={onMutationStateChange}
          onClose={() => handleOpenChange(false)}
          addExercises={addExercises}
          deleteExercise={deleteExercise}
          onCreateBlock={onCreateBlock}
          isLoading={isLoading}
          hasNextPage={!!hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
          pinnedSeeds={matchingSeeds}
          pendingSeedId={pendingSeedId}
          onSelectSeed={(seed) => {
            void handleInstantiate(seed)
          }}
        />
      )}
    </Command>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          onInteractOutside={(e) => e.preventDefault()}
          className="flex h-[80vh] max-h-[80vh] max-w-2xl flex-col gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="shrink-0 px-4 pt-4 pb-2">
            <DialogTitle>{pickerTitle}</DialogTitle>
          </DialogHeader>
          {pickerBody}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="flex h-[75vh] max-h-[75vh] flex-col gap-0 overflow-hidden p-0">
        <DrawerHeader className="shrink-0 px-4 pt-2 pb-0">
          <DrawerTitle>{pickerTitle}</DrawerTitle>
        </DrawerHeader>
        {pickerBody}
      </DrawerContent>
    </Drawer>
  )
}
