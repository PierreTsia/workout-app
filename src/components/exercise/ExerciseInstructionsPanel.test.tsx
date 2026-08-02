import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, fireEvent } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type { Exercise } from "@/types/database"
import { ExerciseInstructionsPanel } from "./ExerciseInstructionsPanel"

const mockUseExerciseFromLibrary = vi.fn<
  (id: string) => { data: Exercise | undefined; isLoading: boolean }
>()

vi.mock("@/hooks/useExerciseFromLibrary", () => ({
  useExerciseFromLibrary: (id: string) => mockUseExerciseFromLibrary(id),
}))

const BASE_EXERCISE: Exercise = {
  id: "ex-1",
  name: "Bench Press",
  muscle_group: "chest",
  emoji: "🏋️",
  is_system: true,
  created_at: "2025-01-01T00:00:00Z",
  youtube_url: null,
  instructions: null,
  image_url: null,
  equipment: "barbell",
  difficulty_level: null,
  name_en: "Bench Press",
  source: "wger:73",
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
}

describe("ExerciseInstructionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders nothing when exercise has no instructions or media", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: BASE_EXERCISE,
      isLoading: false,
    })

    const { container } = renderWithProviders(
      <ExerciseInstructionsPanel exerciseId="ex-1" />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders collapsible trigger when exercise has instruction content", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: {
        ...BASE_EXERCISE,
        instructions: {
          setup: ["Stand with feet shoulder-width apart"],
          movement: [],
          breathing: [],
          common_mistakes: [],
        },
      },
      isLoading: false,
    })

    renderWithProviders(<ExerciseInstructionsPanel exerciseId="ex-1" />)

    expect(screen.getByText("How to perform")).toBeInTheDocument()
  })

  it("expands on click to show instruction sections", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: {
        ...BASE_EXERCISE,
        instructions: {
          setup: ["Adjust the bench"],
          movement: ["Press the bar up"],
          breathing: ["Exhale on push"],
          common_mistakes: ["Flaring elbows"],
        },
      },
      isLoading: false,
    })

    renderWithProviders(<ExerciseInstructionsPanel exerciseId="ex-1" />)

    fireEvent.click(screen.getByText("How to perform"))

    expect(screen.getByText("Setup")).toBeInTheDocument()
    expect(screen.getByText("Adjust the bench")).toBeInTheDocument()
    expect(screen.getByText("Movement")).toBeInTheDocument()
    expect(screen.getByText("Press the bar up")).toBeInTheDocument()
    expect(screen.getByText("Breathing")).toBeInTheDocument()
    expect(screen.getByText("Common mistakes")).toBeInTheDocument()
  })

  const BILINGUAL: Exercise = {
    ...BASE_EXERCISE,
    instructions: {
      setup: ["Allonge-toi sur le banc"],
      movement: ["Pousse la barre"],
      breathing: ["Expire à la poussée"],
      common_mistakes: ["Coudes trop écartés"],
    },
    instructions_en: {
      setup: ["Lie back on the bench"],
      movement: ["Press the bar up"],
      breathing: ["Exhale on the push"],
      common_mistakes: ["Flared elbows"],
    },
    instructions_en_status: "clean",
  }

  it("shows the English steps to an English reader once the status is clean", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: BILINGUAL,
      isLoading: false,
    })

    renderWithProviders(<ExerciseInstructionsPanel exerciseId="ex-1" />, {
      locale: "en",
    })
    fireEvent.click(screen.getByText("How to perform"))

    expect(screen.getByText("Lie back on the bench")).toBeInTheDocument()
    expect(screen.queryByText("Allonge-toi sur le banc")).not.toBeInTheDocument()
  })

  it("shows the French steps to a French reader whatever the status", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: BILINGUAL,
      isLoading: false,
    })

    renderWithProviders(<ExerciseInstructionsPanel exerciseId="ex-1" />, {
      locale: "fr",
    })
    fireEvent.click(screen.getByText("Comment exécuter"))

    expect(screen.getByText("Allonge-toi sur le banc")).toBeInTheDocument()
    expect(screen.queryByText("Lie back on the bench")).not.toBeInTheDocument()
  })

  it("keeps an English reader on French while the translation is flagged", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: { ...BILINGUAL, instructions_en_status: "flagged" },
      isLoading: false,
    })

    renderWithProviders(<ExerciseInstructionsPanel exerciseId="ex-1" />, {
      locale: "en",
    })
    fireEvent.click(screen.getByText("How to perform"))

    expect(screen.getByText("Allonge-toi sur le banc")).toBeInTheDocument()
    expect(screen.queryByText("Lie back on the bench")).not.toBeInTheDocument()
  })

  it("renders YouTube link when youtube_url is present", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: {
        ...BASE_EXERCISE,
        youtube_url: "https://www.youtube.com/watch?v=rT7DgCr-3pg",
      },
      isLoading: false,
    })

    renderWithProviders(<ExerciseInstructionsPanel exerciseId="ex-1" />)
    fireEvent.click(screen.getByText("How to perform"))

    expect(screen.getByText("Watch on YouTube")).toBeInTheDocument()
  })
})
