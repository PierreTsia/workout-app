import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { PreviewCircuitCard } from "./PreviewCircuitCard"
import type { GeneratedCircuit } from "@/types/generator"
import type { ExerciseListItem } from "@/types/database"

function makeExercise(id: string, name: string): ExerciseListItem {
  return {
    id,
    name,
    name_en: name,
    muscle_group: "chest",
    equipment: "bodyweight",
    emoji: "🔥",
    image_url: null,
    difficulty_level: "beginner",
    is_system: true,
    secondary_muscles: [],
  }
}

function makeCircuit(overrides: Partial<GeneratedCircuit> = {}): GeneratedCircuit {
  return {
    label: "Finisher",
    rounds: 3,
    restSeconds: 90,
    transitionSeconds: 0,
    exercises: [
      { exercise: makeExercise("ex-1", "Burpee"), amount: 10, weightKg: 0 },
      { exercise: makeExercise("ex-2", "Lunge"), amount: 12, weightKg: 0 },
    ],
    ...overrides,
  }
}

describe("PreviewCircuitCard", () => {
  it("T189: shows AmrapLabel (AMRAP 20 min + gloss) and never a naked AMRAP", () => {
    renderWithProviders(
      <PreviewCircuitCard
        circuit={makeCircuit({
          label: "Cindy",
          mode: "amrap",
          capMinutes: 20,
          rounds: 1,
          restSeconds: 0,
        })}
        index={0}
        onRemove={vi.fn()}
      />,
    )

    expect(screen.getByText("AMRAP 20 min")).toBeInTheDocument()
    expect(screen.getByText("As many rounds as possible.")).toBeInTheDocument()
    expect(screen.queryByText(/1 round/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^AMRAP$/)).not.toBeInTheDocument()
  })

  it("shows catalog tagline and Rx amounts so a named WOD is not an empty Circuit", () => {
    renderWithProviders(
      <PreviewCircuitCard
        circuit={makeCircuit({
          label: "Cindy",
          mode: "amrap",
          capMinutes: 20,
          taglineFr: "Le WOD de Tom Holland. 20 min.",
          taglineEn: "Tom Holland’s WOD. 20 min.",
          exercises: [
            { exercise: makeExercise("ex-1", "Pull-ups"), amount: 5, weightKg: 0 },
            { exercise: makeExercise("ex-2", "Push-ups"), amount: 10, weightKg: 0 },
            { exercise: makeExercise("ex-3", "Squats"), amount: 15, weightKg: 0 },
          ],
        })}
        index={0}
        onRemove={vi.fn()}
      />,
      { locale: "en" },
    )

    expect(screen.getByText("Tom Holland’s WOD. 20 min.")).toBeInTheDocument()
    expect(screen.getByText(/Pull-ups/)).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("15")).toBeInTheDocument()
    expect(screen.queryByText(/0 exercices/i)).not.toBeInTheDocument()
  })

  it("picks the French tagline when the UI locale is fr", () => {
    renderWithProviders(
      <PreviewCircuitCard
        circuit={makeCircuit({
          label: "Cindy",
          mode: "amrap",
          capMinutes: 20,
          taglineFr: "Le WOD de Tom Holland. 20 min.",
          taglineEn: "Tom Holland’s WOD. 20 min.",
        })}
        index={0}
        onRemove={vi.fn()}
      />,
      { locale: "fr" },
    )

    expect(screen.getByText("Le WOD de Tom Holland. 20 min.")).toBeInTheDocument()
    expect(screen.queryByText("Tom Holland’s WOD. 20 min.")).not.toBeInTheDocument()
  })
})
