import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { ProfileStatCard } from "./ProfileStatCard"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("ProfileStatCard", () => {
  it("paints a positive vs-prior delta green with an up arrow", () => {
    const { container } = renderWithProviders(
      <ProfileStatCard
        title="Sessions"
        value={5}
        delta={{ value: 1, label: "+1 vs prior" }}
      />,
    )

    expect(screen.getByText("5")).toBeInTheDocument()
    const row = screen.getByText("+1 vs prior").closest("p")
    expect(row?.className).toMatch(/emerald/)
    expect(container.querySelector(".lucide-arrow-up")).not.toBeNull()
  })

  it("paints a negative vs-prior delta destructive with a down arrow", () => {
    const { container } = renderWithProviders(
      <ProfileStatCard
        title="Time under the bar"
        value="3h 20"
        delta={{ value: -40, label: "-40 min vs prior" }}
      />,
    )

    expect(screen.getByText("3h 20")).toBeInTheDocument()
    const row = screen.getByText("-40 min vs prior").closest("p")
    expect(row?.className).toMatch(/destructive/)
    expect(container.querySelector(".lucide-arrow-down")).not.toBeNull()
    expect(container.querySelector(".lucide-arrow-up")).toBeNull()
  })

  it("keeps an even vs-prior delta muted with no arrow", () => {
    const { container } = renderWithProviders(
      <ProfileStatCard
        title="Sessions"
        value={5}
        delta={{ value: 0, label: "even vs prior" }}
      />,
    )

    const row = screen.getByText("even vs prior").closest("p")
    expect(row?.className).toMatch(/muted-foreground/)
    expect(row?.className).not.toMatch(/emerald/)
    expect(row?.className).not.toMatch(/destructive/)
    expect(container.querySelector(".lucide-arrow-up")).toBeNull()
    expect(container.querySelector(".lucide-arrow-down")).toBeNull()
  })

  it("renders the hero count at dashboard scale", () => {
    renderWithProviders(<ProfileStatCard title="Sessions" value={5} />)

    const hero = screen.getByText("5")
    expect(hero.className).toMatch(/text-(4|5)xl/)
  })

  it("vertically centers the card body instead of top-stacking", () => {
    const { container } = renderWithProviders(
      <ProfileStatCard title="Sessions" value={5} />,
    )

    const card = container.firstElementChild
    expect(card?.className).toMatch(/flex/)
    expect(card?.className).toMatch(/h-full/)
    expect(card?.className).toMatch(/justify-center/)
  })
})
