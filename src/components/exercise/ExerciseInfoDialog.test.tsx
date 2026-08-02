import { describe, it, expect } from "vitest"
import { fireEvent, screen } from "@testing-library/react"

import { renderWithProviders } from "@/test/utils"
import type { Exercise } from "@/types/database"
import { ExerciseInfoDialog } from "./ExerciseInfoDialog"

const BASE_EXERCISE: Exercise = {
  id: "ex-1",
  name: "Développé couché",
  muscle_group: "Pectoraux",
  emoji: "🏋️",
  is_system: true,
  created_at: "2026-01-01T00:00:00Z",
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

const openDialog = () =>
  fireEvent.click(screen.getByRole("button", { name: "" }))

describe("ExerciseInfoDialog", () => {
  it("renders nothing when the row has neither instructions nor a video", () => {
    const { container } = renderWithProviders(
      <ExerciseInfoDialog exercise={BASE_EXERCISE} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("shows the English steps to an English reader once the status is clean", () => {
    renderWithProviders(<ExerciseInfoDialog exercise={BILINGUAL} />, {
      locale: "en",
    })
    openDialog()

    expect(screen.getByText("Lie back on the bench")).toBeInTheDocument()
    expect(screen.queryByText("Allonge-toi sur le banc")).not.toBeInTheDocument()
  })

  it("keeps a French reader on French", () => {
    renderWithProviders(<ExerciseInfoDialog exercise={BILINGUAL} />, {
      locale: "fr",
    })
    openDialog()

    expect(screen.getByText("Allonge-toi sur le banc")).toBeInTheDocument()
    expect(screen.queryByText("Lie back on the bench")).not.toBeInTheDocument()
  })
})
