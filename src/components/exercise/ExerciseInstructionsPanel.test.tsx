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

  it("shows image when image_url is present", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: {
        ...BASE_EXERCISE,
        image_url: "bench-press.jpg",
      },
      isLoading: false,
    })

    const { container } = renderWithProviders(
      <ExerciseInstructionsPanel exerciseId="ex-1" />,
    )
    fireEvent.click(screen.getByText("How to perform"))

    const img = container.querySelector("img")
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("bench-press.jpg"),
    )
  })

  it("hides image on simulated load error", () => {
    mockUseExerciseFromLibrary.mockReturnValue({
      data: {
        ...BASE_EXERCISE,
        image_url: "broken.jpg",
      },
      isLoading: false,
    })

    const { container } = renderWithProviders(
      <ExerciseInstructionsPanel exerciseId="ex-1" />,
    )
    fireEvent.click(screen.getByText("How to perform"))

    const img = container.querySelector("img")!
    fireEvent.error(img)

    expect(container.querySelector("img")).not.toBeInTheDocument()
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
