import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { RADAR_CURRENT } from "@/components/profile/charts/fixtures"
import { MuscleSetRanks } from "./MuscleSetRanks"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("MuscleSetRanks", () => {
  it("translates canonical muscle names for an English reader", () => {
    renderWithProviders(<MuscleSetRanks values={RADAR_CURRENT} />, {
      locale: "en",
    })

    const ranks = screen.getByRole("list")
    expect(ranks).not.toHaveTextContent("Pectoraux")
    expect(ranks).not.toHaveTextContent("Adducteurs")
    expect(ranks).toHaveTextContent("Chest")
    expect(ranks).toHaveTextContent("Adductors")
  })
})
