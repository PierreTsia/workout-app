import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"

import { renderWithProviders } from "@/test/utils"
import type { Exercise } from "@/types/database"
import { ExerciseDetailSheet } from "./ExerciseDetailSheet"

const BILINGUAL: Exercise = {
  id: "ex-1",
  name: "Développé couché",
  muscle_group: "Pectoraux",
  emoji: "🏋️",
  is_system: true,
  created_at: "2026-01-01T00:00:00Z",
  youtube_url: null,
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
  image_url: null,
  equipment: "barbell",
  difficulty_level: null,
  name_en: "Bench Press",
  source: "wger:73",
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
}

const renderSheet = (exercise: Exercise, locale: "en" | "fr") =>
  renderWithProviders(
    <ExerciseDetailSheet exercise={exercise} open onOpenChange={() => {}} />,
    { locale },
  )

describe("ExerciseDetailSheet", () => {
  // The row here comes straight from `search_exercises` without a refetch by
  // id, so this is the surface that proves the RPC carries the translation.
  it("shows the English steps to an English reader once the status is clean", () => {
    renderSheet(BILINGUAL, "en")

    expect(screen.getByText("Lie back on the bench")).toBeInTheDocument()
    expect(screen.queryByText("Allonge-toi sur le banc")).not.toBeInTheDocument()
  })

  it("keeps a French reader on French", () => {
    renderSheet(BILINGUAL, "fr")

    expect(screen.getByText("Allonge-toi sur le banc")).toBeInTheDocument()
    expect(screen.queryByText("Lie back on the bench")).not.toBeInTheDocument()
  })

  it("renders no instruction section when the row has none", () => {
    renderSheet({ ...BILINGUAL, instructions: null, instructions_en: null }, "en")

    expect(screen.queryByText("Setup")).not.toBeInTheDocument()
  })
})
