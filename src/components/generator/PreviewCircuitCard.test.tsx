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
})
