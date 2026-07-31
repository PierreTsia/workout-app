import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { Exercise } from "@/types/database"
import { DataTable } from "./DataTable"

const exercise = (overrides: Partial<Exercise> & { id: string }): Exercise => ({
  name: "Développé couché",
  name_en: "Bench Press",
  muscle_group: "Pectoraux",
  equipment: "barbell",
  emoji: "🏋️",
  is_system: true,
  created_at: "",
  youtube_url: null,
  instructions: null,
  image_url: null,
  difficulty_level: null,
  source: null,
  secondary_muscles: null,
  reviewed_at: null,
  reviewed_by: null,
  ...overrides,
})

const DATA: Exercise[] = [
  exercise({ id: "bench" }),
  exercise({
    id: "curl",
    name: "Curl biceps",
    name_en: "Bicep Curl",
    muscle_group: "Biceps",
    equipment: "dumbbell",
  }),
]

function render(locale: "en" | "fr" = "en") {
  return renderWithProviders(<DataTable data={DATA} />, { locale })
}

describe("admin exercises DataTable", () => {
  it("translates the muscle and equipment cells", () => {
    render()

    expect(screen.getByText("Chest")).toBeInTheDocument()
    expect(screen.getByText("Barbell")).toBeInTheDocument()
  })

  // The name column deliberately keeps the stored value: admins edit the
  // catalog, so they need to see what is actually written in it.
  it("keeps the stored name in the name column", () => {
    render()

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })

  // Searching for what is on screen has to work, or translating the cell made
  // the table worse than when it showed the stored value.
  it("searches on the translated muscle label", async () => {
    const user = userEvent.setup()
    render()

    await user.type(screen.getByPlaceholderText(/search/i), "Chest")

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Curl biceps")).not.toBeInTheDocument()
  })

  it("searches on the translated equipment label", async () => {
    const user = userEvent.setup()
    render()

    await user.type(screen.getByPlaceholderText(/search/i), "Dumbbell")

    expect(screen.getByText("Curl biceps")).toBeInTheDocument()
    expect(screen.queryByText("Développé couché")).not.toBeInTheDocument()
  })

  // An admin who has typed French muscle names for a year should not have to
  // stop.
  it("still searches on the stored canonical value", async () => {
    const user = userEvent.setup()
    render()

    await user.type(screen.getByPlaceholderText(/search/i), "Pectoraux")

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.queryByText("Curl biceps")).not.toBeInTheDocument()
  })
})
