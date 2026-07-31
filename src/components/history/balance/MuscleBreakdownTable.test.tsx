import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderWithProviders } from "@/test/utils"
import type { VolumeByMuscleRow } from "@/lib/volumeByMuscleGroup"
import { MuscleBreakdownTable } from "./MuscleBreakdownTable"

const MUSCLES: VolumeByMuscleRow[] = [
  {
    muscle_group: "Pectoraux",
    total_sets: 12,
    total_volume_kg: 4200,
    exercise_count: 3,
  },
  {
    muscle_group: "Ischios",
    total_sets: 6,
    total_volume_kg: 1800,
    exercise_count: 2,
  },
]

async function renderOpened(locale?: "en" | "fr") {
  const user = userEvent.setup()
  renderWithProviders(<MuscleBreakdownTable muscles={MUSCLES} />, { locale })
  // The breakdown lives in a closed Collapsible; Radix mounts nothing until open.
  await user.click(screen.getByRole("button"))
}

describe("MuscleBreakdownTable", () => {
  it("translates the canonical muscle names in English", async () => {
    await renderOpened("en")

    expect(screen.getByText("Chest")).toBeInTheDocument()
    expect(screen.getByText("Hamstrings")).toBeInTheDocument()
  })

  it("leaves the canonical French names untouched in French", async () => {
    await renderOpened("fr")

    expect(screen.getByText("Pectoraux")).toBeInTheDocument()
    expect(screen.getByText("Ischios")).toBeInTheDocument()
  })

  it("never renders a raw i18n key", async () => {
    await renderOpened("en")

    // Unanchored on purpose: `t()` echoes back whatever key it was handed, so
    // a mispointed lookup can surface as `muscles.X` or `balance.muscles.X`.
    expect(screen.queryByText(/muscles\./)).not.toBeInTheDocument()
  })
})
