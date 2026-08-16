import { useState } from "react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { Exercise } from "@/types/database"
import type { CatalogPreviewRow } from "@/lib/previewCatalogCircuit"
import { ExerciseLibraryPicker } from "./ExerciseLibraryPicker"

const PULL_ID = "11111111-1111-4111-8111-111111111111"

function makeCindySeed(
  overrides: Partial<CatalogPreviewRow> = {},
): CatalogPreviewRow {
  return {
    id: "cindy-id",
    slug: "cindy",
    label: "Cindy",
    aliases: ["holland"],
    rx: {
      mode: "amrap",
      cap_seconds: 1200,
      exercises: [{ exercise_id: PULL_ID, amount: 5, weight: 0 }],
    },
    tagline_fr: "Le WOD de Tom Holland.",
    tagline_en: "Tom Holland’s WOD.",
    ...overrides,
  }
}

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true,
}))

const EXERCISES: Exercise[] = [
  {
    id: "1",
    name: "Développé couché",
    name_en: "Bench Press",
    muscle_group: "Pectoraux",
    equipment: "barbell",
    difficulty_level: "beginner",
    emoji: "🏋️",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:73",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    id: "2",
    name: "Élévations latérales",
    name_en: "Lateral Raises",
    muscle_group: "Épaules",
    equipment: "dumbbell",
    difficulty_level: "intermediate",
    emoji: "🙆",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:348",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    id: "3",
    name: "Presse à cuisse",
    name_en: "Leg Press",
    muscle_group: "Quadriceps",
    equipment: "machine",
    difficulty_level: "advanced",
    emoji: "🦵",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:371",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    id: "4",
    name: "Curls biceps inclinés",
    name_en: "Dumbbell Incline Curl",
    muscle_group: "Biceps",
    equipment: "dumbbell",
    difficulty_level: null,
    emoji: "💪",
    is_system: true,
    created_at: "2025-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    source: "wger:204",
    secondary_muscles: null,
    reviewed_at: null,
    reviewed_by: null,
  },
]

const mockFetchNextPage = vi.fn()
function paginatedReturn(params: {
  muscleGroup?: string | null
  equipment?: string[]
  difficulty?: string[]
}) {
  let list = EXERCISES
  if (params.muscleGroup) {
    list = list.filter((e) => e.muscle_group === params.muscleGroup)
  }
  if (params.equipment?.length) {
    list = list.filter((e) => params.equipment!.includes(e.equipment))
  }
  if (params.difficulty?.length) {
    list = list.filter(
      (e) => e.difficulty_level != null && params.difficulty!.includes(e.difficulty_level),
    )
  }
  return {
    data: list,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: mockFetchNextPage,
  }
}
const mockUseExerciseLibraryPaginated = vi.fn(
  (params: {
    muscleGroup?: string | null
    equipment?: string[]
    difficulty?: string[]
  }) => paginatedReturn(params),
)
const mockUseExerciseFilterOptions = vi.fn(() => ({
  data: {
    muscle_groups: ["Biceps", "Épaules", "Pectoraux", "Quadriceps"],
    equipment: ["barbell", "dumbbell", "machine"],
    difficulty_levels: ["beginner", "intermediate", "advanced"],
  },
  isLoading: false,
}))

const mockAddExercisesMutateAsync = vi.fn().mockResolvedValue(undefined)
const mockDeleteExerciseMutateAsync = vi.fn().mockResolvedValue(undefined)
const mockUseAddExercisesToDay = vi.fn(() => ({
  mutateAsync: mockAddExercisesMutateAsync,
  isPending: false,
}))
const mockUseDeleteExercise = vi.fn(() => ({
  mutateAsync: mockDeleteExerciseMutateAsync,
  isPending: false,
}))

vi.mock("@/hooks/useExerciseLibraryPaginated", () => ({
  useExerciseLibraryPaginated: (params: {
    search?: string
    muscleGroup?: string | null
    equipment?: string[]
    difficulty?: string[]
  }) => mockUseExerciseLibraryPaginated(params),
}))
vi.mock("@/hooks/useExerciseFilterOptions", () => ({
  useExerciseFilterOptions: () => mockUseExerciseFilterOptions(),
}))

vi.mock("@/hooks/useBuilderMutations", () => ({
  useAddExercisesToDay: () => mockUseAddExercisesToDay(),
  useDeleteExercise: () => mockUseDeleteExercise(),
}))

const mockUseBenchmarkSeeds = vi.fn((enabled: boolean) => {
  void enabled
  return {
    data: [] as CatalogPreviewRow[],
    isLoading: false,
    isError: false,
  }
})
const mockInstantiateMutateAsync = vi.fn().mockResolvedValue({ blockId: "b-1" })
const mockUseInstantiateBenchmarkOnDay = vi.fn(() => ({
  mutateAsync: mockInstantiateMutateAsync,
  isPending: false,
  variables: undefined,
}))

vi.mock("@/hooks/useBenchmarkSeeds", () => ({
  useBenchmarkSeeds: (enabled: boolean) => mockUseBenchmarkSeeds(enabled),
}))
vi.mock("@/hooks/useInstantiateBenchmarkOnDay", () => ({
  useInstantiateBenchmarkOnDay: () => mockUseInstantiateBenchmarkOnDay(),
}))
vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

vi.mock("@/components/exercise/ExerciseInfoDialog", () => ({
  ExerciseInfoDialog: () => null,
}))

vi.mock("@/components/exercise/ExerciseThumbnail", () => ({
  ExerciseThumbnail: () => <div data-testid="thumbnail" />,
}))

/**
 * Renders in English like the rest of this file's assertions, so the expected
 * exercise labels are the `name_en` values — the picker localizes them (T149).
 */
function renderPicker(overrides = {}, locale: "en" | "fr" = "en") {
  return renderWithProviders(
    <ExerciseLibraryPicker
      open={true}
      onOpenChange={vi.fn()}
      dayId="day-1"
      existingExerciseCount={0}
      onMutationStateChange={vi.fn()}
      {...overrides}
    />,
    { locale },
  )
}

describe("ExerciseLibraryPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    })
    mockInstantiateMutateAsync.mockResolvedValue({ blockId: "b-1" })
    mockUseExerciseLibraryPaginated.mockImplementation(
      (params: {
        muscleGroup?: string | null
        equipment?: string[]
        difficulty?: string[]
      }) => paginatedReturn(params),
    )
  })

  // The picker feeds the rows the day and session localize. If it stayed on the
  // canonical `name`, an English reader would pick "Développé couché" and watch
  // "Bench Press" appear in its place — one screen, two languages.
  it("lists the English catalog names for an English reader", () => {
    renderPicker({}, "en")

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.getByText("Lateral Raises")).toBeInTheDocument()
    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
  })

  it("lists the canonical names for a French reader", () => {
    renderPicker({}, "fr")

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })

  it("renders all exercises grouped by muscle", () => {
    renderPicker()
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.getByText("Lateral Raises")).toBeInTheDocument()
    expect(screen.getByText("Leg Press")).toBeInTheDocument()
    expect(screen.getByText("Dumbbell Incline Curl")).toBeInTheDocument()
  })

  it("shows filter icon", () => {
    renderPicker()
    expect(screen.getByLabelText("Filters")).toBeInTheDocument()
  })

  it("shows filter panel when filter icon is clicked", async () => {
    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    expect(screen.getByRole("button", { name: "Barbell" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Chest" })).toBeInTheDocument()
  })

  it("filters by equipment when a pill is selected", async () => {
    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Machine" }))

    expect(screen.getByText("Leg Press")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
    expect(screen.queryByText("Lateral Raises")).not.toBeInTheDocument()
  })

  it("filters by muscle group when a pill is selected", async () => {
    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Chest" }))

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.queryByText("Lateral Raises")).not.toBeInTheDocument()
    expect(screen.queryByText("Leg Press")).not.toBeInTheDocument()
  })

  it("filters by difficulty when a pill is selected", async () => {
    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Beginner" }))

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.queryByText("Lateral Raises")).not.toBeInTheDocument()
    expect(screen.queryByText("Leg Press")).not.toBeInTheDocument()
    expect(screen.queryByText("Dumbbell Incline Curl")).not.toBeInTheDocument()
  })

  it("includes difficulty in active filter count", async () => {
    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Beginner" }))

    expect(screen.getByLabelText("Filters")).toHaveTextContent("1")
  })

  it("combines muscle group and equipment filters", async () => {
    const pectoralDumbbell = {
      ...EXERCISES[0],
      id: "5",
      name: "Écarté haltères",
      name_en: "Dumbbell Fly",
      equipment: "dumbbell",
    }
    mockUseExerciseLibraryPaginated.mockImplementation(
      (params: {
        muscleGroup?: string | null
        equipment?: string[]
        difficulty?: string[]
      }) => {
        if (
          params.muscleGroup === "Pectoraux" &&
          params.equipment?.includes("dumbbell")
        ) {
          return {
            data: [pectoralDumbbell],
            isLoading: false,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: mockFetchNextPage,
          }
        }
        return paginatedReturn(params)
      },
    )

    renderPicker()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Chest" }))
    await user.click(screen.getByRole("button", { name: "Dumbbell" }))

    expect(screen.getByText("Dumbbell Fly")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })

  it("shows loading state", () => {
    mockUseExerciseLibraryPaginated.mockReturnValue({
      data: [] as Exercise[],
      isLoading: true,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
    })
    renderPicker()
    expect(screen.getByText("Add Exercise")).toBeInTheDocument()
  })

  it("shows empty state when no exercises match", () => {
    mockUseExerciseLibraryPaginated.mockReturnValue({
      data: [],
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextPage,
    })
    renderPicker()
    expect(screen.getByText("No exercises found.")).toBeInTheDocument()
  })

  it("shows Load more when hasNextPage and calls fetchNextPage on click", async () => {
    mockUseExerciseLibraryPaginated.mockReturnValue({
      data: EXERCISES,
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage: mockFetchNextPage,
    })
    renderPicker()
    const loadMore = screen.getByRole("button", { name: /load more/i })
    expect(loadMore).toBeInTheDocument()
    await userEvent.setup().click(loadMore)
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1)
  })

  it("adds one exercise when one checkbox selected and Apply changes clicked", async () => {
    renderPicker()
    const user = userEvent.setup()
    const checkboxes = screen.getAllByRole("checkbox", { name: "Add" })
    await user.click(checkboxes[0])
    await user.click(screen.getByRole("button", { name: "Apply changes" }))
    expect(mockAddExercisesMutateAsync).toHaveBeenCalledTimes(1)
    const [vars] = mockAddExercisesMutateAsync.mock.calls[0]
    expect(vars.exercises).toHaveLength(1)
    expect(vars).toMatchObject({ dayId: "day-1", startSortOrder: 0 })
  })

  it("does not add exercise when row text is clicked", async () => {
    renderPicker()
    const user = userEvent.setup()
    await user.click(screen.getByText("Bench Press"))
    expect(mockAddExercisesMutateAsync).not.toHaveBeenCalled()
  })

  it("shows Apply changes button and batch-adds when checkboxes selected", async () => {
    renderPicker()
    const user = userEvent.setup()
    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes.length).toBeGreaterThanOrEqual(2)
    await user.click(checkboxes[0])
    await user.click(checkboxes[1])
    expect(screen.getByRole("button", { name: "Apply changes" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Apply changes" }))
    expect(mockAddExercisesMutateAsync).toHaveBeenCalledTimes(1)
    const [vars] = mockAddExercisesMutateAsync.mock.calls[0]
    expect(vars).toMatchObject({
      dayId: "day-1",
      startSortOrder: 0,
    })
    expect(Array.isArray(vars.exercises)).toBe(true)
    expect(vars.exercises).toHaveLength(2)
  })

  it("pre-checks exercises already in the day", async () => {
    renderPicker({
      existingExercises: [{ exercise_id: "1", id: "we-1" }],
    })
    const checked = await screen.findByRole("checkbox", { checked: true })
    expect(checked).toBeInTheDocument()
  })

  it("calls delete when existing exercise is unchecked and Apply changes clicked", async () => {
    renderPicker({
      existingExerciseCount: 1,
      existingExercises: [{ exercise_id: "1", id: "we-1" }],
    })
    const user = userEvent.setup()
    const checked = screen.getByRole("checkbox", { checked: true })
    await user.click(checked)
    await user.click(screen.getByRole("button", { name: "Apply changes" }))
    expect(mockDeleteExerciseMutateAsync).toHaveBeenCalledWith({ id: "we-1", dayId: "day-1" })
  })

  it("keeps Apply changes visible after filtering hides a selected exercise", async () => {
    renderPicker()
    const user = userEvent.setup()

    const checkboxes = screen.getAllByRole("checkbox", { name: "Add" })
    await user.click(checkboxes[0]) // Développé couché (Pectoraux)
    await user.click(checkboxes[1]) // Élévations latérales (Épaules)

    expect(
      screen.getByRole("button", { name: "Apply changes" }),
    ).toBeInTheDocument()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Chest" }))

    expect(screen.queryByText("Lateral Raises")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Apply changes" }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Apply changes" }))
    const [vars] = mockAddExercisesMutateAsync.mock.calls[0]
    expect(vars.exercises).toHaveLength(2)
  })

  it("keeps selections when a new search triggers a loading state", async () => {
    // A new search term is a fresh query key with no cache → isLoading flips
    // true. The picker must not unmount its selection subtree on that flash.
    mockUseExerciseLibraryPaginated.mockImplementation(
      (params: {
        search?: string
        muscleGroup?: string | null
        equipment?: string[]
        difficulty?: string[]
      }) =>
        params.search
          ? {
              data: [] as Exercise[],
              isLoading: true,
              isFetchingNextPage: false,
              hasNextPage: false,
              fetchNextPage: mockFetchNextPage,
            }
          : paginatedReturn(params),
    )

    const onCreateBlock = vi.fn().mockResolvedValue(undefined)
    renderPicker({ onCreateBlock })
    const user = userEvent.setup()

    const checkboxes = screen.getAllByRole("checkbox", { name: "Add" })
    await user.click(checkboxes[0])
    await user.click(checkboxes[1])

    expect(
      screen.getByRole("button", { name: /create circuit \(2 exercises\)/i }),
    ).toBeInTheDocument()

    await user.type(
      screen.getByLabelText("Search exercises..."),
      "tract",
    )

    await screen.findByRole(
      "button",
      { name: /create circuit \(2 exercises\)/i },
      { timeout: 2000 },
    )
  })

  it("keeps create circuit CTA visible after filtering in block mode", async () => {
    const onCreateBlock = vi.fn().mockResolvedValue(undefined)
    renderPicker({ onCreateBlock })
    const user = userEvent.setup()

    const checkboxes = screen.getAllByRole("checkbox", { name: "Add" })
    await user.click(checkboxes[0])
    await user.click(checkboxes[1])

    expect(
      screen.getByRole("button", { name: /create circuit \(2 exercises\)/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Chest" }))

    expect(screen.queryByText("Lateral Raises")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /create circuit \(2 exercises\)/i }),
    ).toBeInTheDocument()
  })

  it("shows the Exercises | Circuits kind toggle when the instantiate path is present", () => {
    renderPicker({ existingMaxSortOrder: -1 })

    expect(screen.getByRole("radio", { name: "Exercises" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Circuits" })).toBeInTheDocument()
  })

  it("keeps a locked dialog height when switching to Circuits", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()
    const dialog = screen.getByRole("dialog")

    expect(dialog).toHaveClass("h-[80vh]", "max-h-[80vh]")

    await user.click(screen.getByRole("radio", { name: "Circuits" }))

    expect(screen.getByRole("dialog")).toHaveClass("h-[80vh]", "max-h-[80vh]")
    expect(screen.getByRole("button", { name: "Cindy" })).toBeInTheDocument()
  })

  it("does not show the kind toggle in Create circuit (block) mode", () => {
    renderPicker({ onCreateBlock: vi.fn() })

    expect(screen.queryByRole("radio", { name: "Exercises" })).not.toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: "Circuits" })).not.toBeInTheDocument()
  })

  it("lists Cindy as a WOD card on the Circuits kind", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()

    await user.click(screen.getByRole("radio", { name: "Circuits" }))

    expect(screen.getByRole("button", { name: "Cindy" })).toBeInTheDocument()
    expect(screen.getByText("AMRAP 20 min")).toBeInTheDocument()
    expect(screen.getByText("Tom Holland’s WOD.")).toBeInTheDocument()
    expect(screen.queryByText("5-10-15")).not.toBeInTheDocument()
  })

  it("lists Cindy and all eight Pantheon seeds on an empty Circuits query", async () => {
    const pantheonSeeds = [
      { slug: "zeus", label: "Zeus ⚡" },
      { slug: "heracles", label: "Heracles 🦁" },
      { slug: "ares", label: "Ares 🗡️" },
      { slug: "theseus", label: "Theseus 🐂" },
      { slug: "athena", label: "Athena 🦉" },
      { slug: "atlas", label: "Atlas 🌍" },
      { slug: "hades", label: "Hades 🌑" },
      { slug: "achilles", label: "Achilles 🛡️" },
    ].map(({ slug, label }) =>
      makeCindySeed({
        id: `${slug}-id`,
        slug,
        label,
        aliases: [],
      }),
    )
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed(), ...pantheonSeeds],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()
    const expectedLabels = [
      "Cindy",
      ...pantheonSeeds.map(({ label }) => label),
    ]

    await user.click(screen.getByRole("radio", { name: "Circuits" }))

    expectedLabels.forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    })
  })

  it("keeps the kind toggle visible and shows empty copy when there are no seeds", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()

    await user.click(screen.getByRole("radio", { name: "Circuits" }))

    expect(screen.getByRole("radio", { name: "Exercises" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Circuits" })).toBeInTheDocument()
    expect(screen.getByText("No benchmark circuits yet.")).toBeInTheDocument()
  })

  it("shows error copy on Circuits and still lists exercises on Exercises", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()

    await user.click(screen.getByRole("radio", { name: "Circuits" }))
    expect(screen.getByText("Couldn’t load circuits.")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Exercises" })).toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: "Exercises" }))
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
  })

  it("closes the sheet after a successful Cindy tap", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    const onOpenChange = vi.fn()
    const onMutationStateChange = vi.fn()
    renderPicker({
      existingMaxSortOrder: -1,
      onOpenChange,
      onMutationStateChange,
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole("radio", { name: "Circuits" }))
    await user.click(screen.getByRole("button", { name: "Cindy" }))

    expect(mockInstantiateMutateAsync).toHaveBeenCalledWith({
      dayId: "day-1",
      catalog: makeCindySeed(),
      existingMaxSortOrder: -1,
    })
    expect(onMutationStateChange).toHaveBeenCalledWith("saved")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("does not start a second instantiate while one is already in flight", async () => {
    const fran = makeCindySeed({
      id: "fran-id",
      slug: "fran",
      label: "Fran",
      aliases: [],
      tagline_en: "Thrusters and pull-ups.",
      tagline_fr: "Thrusters et tractions.",
    })
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed(), fran],
      isLoading: false,
      isError: false,
    })
    const hold: { resolve: (value: { blockId: string }) => void } = {
      resolve: () => {},
    }
    mockInstantiateMutateAsync.mockImplementation(
      () =>
        new Promise<{ blockId: string }>((resolve) => {
          hold.resolve = resolve
        }),
    )
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()

    await user.click(screen.getByRole("radio", { name: "Circuits" }))
    await user.click(screen.getByRole("button", { name: "Cindy" }))
    await user.click(screen.getByRole("button", { name: "Fran" }))

    expect(mockInstantiateMutateAsync).toHaveBeenCalledTimes(1)
    hold.resolve({ blockId: "b-1" })
  })

  it("keeps the sheet open and toasts when instantiate throws", async () => {
    const { toast } = await import("sonner")
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    mockInstantiateMutateAsync.mockRejectedValueOnce(new Error("offline"))
    const onOpenChange = vi.fn()
    const onMutationStateChange = vi.fn()
    renderPicker({
      existingMaxSortOrder: -1,
      onOpenChange,
      onMutationStateChange,
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole("radio", { name: "Circuits" }))
    await user.click(screen.getByRole("button", { name: "Cindy" }))

    expect(toast.error).toHaveBeenCalledWith("Couldn’t add this circuit.")
    expect(onMutationStateChange).toHaveBeenCalledWith("error")
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole("button", { name: "Cindy" })).toBeInTheDocument()
  })

  it("hides muscle filters on the Circuits kind", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()

    await user.click(screen.getByRole("radio", { name: "Circuits" }))

    expect(screen.queryByLabelText("Filters")).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Circuits" })).toBeInTheDocument()
  })

  it("resets to the Exercises kind when the picker is closed and reopened", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })

    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Reopen
          </button>
          <ExerciseLibraryPicker
            open={open}
            onOpenChange={setOpen}
            dayId="day-1"
            existingExerciseCount={0}
            onMutationStateChange={vi.fn()}
            existingMaxSortOrder={-1}
          />
        </>
      )
    }

    renderWithProviders(<Harness />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("radio", { name: "Circuits" }))
    expect(screen.getByRole("button", { name: "Cindy" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(screen.getByRole("button", { name: "Reopen" }))

    expect(screen.getByRole("radio", { name: "Exercises" })).toBeChecked()
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cindy" })).not.toBeInTheDocument()
  })

  it("does not fetch seeds when the Create circuit picker is open", () => {
    renderPicker({ onCreateBlock: vi.fn() })
    expect(mockUseBenchmarkSeeds).toHaveBeenCalledWith(false)
  })

  it("does not pin a seed card on Exercises when the query is empty", () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })

    expect(screen.getByRole("radio", { name: "Exercises" })).toBeChecked()
    expect(screen.queryByRole("button", { name: "Cindy" })).not.toBeInTheDocument()
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
  })

  it("pins Cindy above muscle groups when searching her name from Exercises", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText("Search exercises..."), "cindy")

    const cindy = screen.getByRole("button", { name: "Cindy" })
    const bench = screen.getByText("Bench Press")
    expect(cindy.compareDocumentPosition(bench) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole("radio", { name: "Exercises" })).toBeChecked()
  })

  it("does not pin a seed card on Exercises for a one-character query", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText("Search exercises..."), "c")

    expect(screen.queryByRole("button", { name: "Cindy" })).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Exercises" })).toBeChecked()
  })

  it("filters the Circuits list with the same matcher", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [
        makeCindySeed(),
        makeCindySeed({
          id: "zeus-id",
          slug: "zeus",
          label: "Zeus",
          aliases: [],
          tagline_en: "A rounds benchmark.",
          tagline_fr: "Un benchmark en tours.",
        }),
      ],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()

    await user.click(screen.getByRole("radio", { name: "Circuits" }))
    expect(screen.getByRole("button", { name: "Cindy" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Zeus" })).toBeInTheDocument()

    await user.type(screen.getByLabelText("Search exercises..."), "cindy")

    expect(screen.getByRole("button", { name: "Cindy" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Zeus" })).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Circuits" })).toBeChecked()
  })

  it("shows empty copy on Circuits when the query matches no seed", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()

    await user.click(screen.getByRole("radio", { name: "Circuits" }))
    await user.type(screen.getByLabelText("Search exercises..."), "zzzz")

    expect(screen.getByText("No benchmark circuits yet.")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Circuits" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cindy" })).not.toBeInTheDocument()
  })

  it("instantiates from a pinned Cindy card without leaving Exercises", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    const onOpenChange = vi.fn()
    const onMutationStateChange = vi.fn()
    renderPicker({
      existingMaxSortOrder: -1,
      onOpenChange,
      onMutationStateChange,
    })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText("Search exercises..."), "cindy")
    expect(screen.getByRole("radio", { name: "Exercises" })).toBeChecked()
    await user.click(screen.getByRole("button", { name: "Cindy" }))

    expect(mockInstantiateMutateAsync).toHaveBeenCalledWith({
      dayId: "day-1",
      catalog: makeCindySeed(),
      existingMaxSortOrder: -1,
    })
    expect(onMutationStateChange).toHaveBeenCalledWith("saved")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("keeps the pinned Cindy card when muscle filters hide other exercises", async () => {
    mockUseBenchmarkSeeds.mockReturnValue({
      data: [makeCindySeed()],
      isLoading: false,
      isError: false,
    })
    renderPicker({ existingMaxSortOrder: -1 })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText("Search exercises..."), "holland")
    await user.click(screen.getByLabelText("Filters"))
    await user.click(screen.getByRole("button", { name: "Chest" }))

    expect(screen.getByRole("button", { name: "Cindy" })).toBeInTheDocument()
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.queryByText("Lateral Raises")).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Exercises" })).toBeChecked()
  })
})
