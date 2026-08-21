import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { ProfilePage } from "@/pages/ProfilePage"
import {
  restoreChartLayout,
  stubChartLayout,
} from "@/components/profile/charts/chartTestLayout"
import enProfile from "@/locales/en/profile.json"
import frProfile from "@/locales/fr/profile.json"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("profile pulse tiles", () => {
  beforeEach(() => {
    stubChartLayout()
  })

  afterEach(() => {
    restoreChartLayout()
  })

  it("stretches the three tiles so they share a row height", () => {
    renderWithProviders(<ProfilePage />)

    const grid = screen.getByText("Sessions").closest(".grid")
    expect(grid?.className).toMatch(/items-stretch/)
  })

  it("labels duration as session time, not time under the bar", () => {
    renderWithProviders(<ProfilePage />)

    expect(screen.getByText("Session time")).toBeInTheDocument()
    expect(screen.queryByText("Time under the bar")).not.toBeInTheDocument()
    expect(screen.queryByText(/under the bar/i)).not.toBeInTheDocument()
    expect(enProfile.pulse.sessionTime).toBe("Session time")
    expect(frProfile.pulse.sessionTime).toBe("Temps de séance")
  })
})
