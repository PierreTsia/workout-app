import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"

import { renderWithProviders } from "@/test/utils"
import type { ExerciseListItem } from "@/types/database"
import { ExerciseSwapPicker } from "./ExerciseSwapPicker"

vi.mock("@/hooks/useExerciseById", () => ({
  useExerciseById: () => ({ data: null, isLoading: false }),
}))

const POOL = [
  {
    id: "lib-1",
    name: "Développé couché",
    name_en: "Bench Press",
    muscle_group: "Pectoraux",
    equipment: "barbell",
    emoji: "💪",
  },
  {
    id: "lib-2",
    name: "Gainage latéral",
    name_en: null,
    muscle_group: "Pectoraux",
    equipment: "bodyweight",
    emoji: "🧘",
  },
] as ExerciseListItem[]

const render = (locale: "en" | "fr") =>
  renderWithProviders(
    <ExerciseSwapPicker
      pool={POOL}
      currentExerciseIds={[]}
      muscleGroup="Pectoraux"
      onSelect={vi.fn()}
      onClose={vi.fn()}
    />,
    { locale },
  )

describe("ExerciseSwapPicker", () => {
  // The picker feeds the rows the session localizes. If it stayed on `name`, the
  // user would pick "Développé couché" and watch an English name appear in its
  // place — the mixed-language screen this epic exists to remove.
  it("offers English names to an English reader", () => {
    render("en")

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
  })

  it("offers French names to a French reader", () => {
    render("fr")

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })

  it("keeps the canonical name in both locales when name_en is missing", () => {
    render("en")

    expect(screen.getByText("Gainage latéral")).toBeInTheDocument()
  })

  it("still filters candidates on the canonical muscle group", () => {
    renderWithProviders(
      <ExerciseSwapPicker
        pool={POOL}
        currentExerciseIds={[]}
        muscleGroup="Dos"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
      { locale: "en" },
    )

    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })
})
