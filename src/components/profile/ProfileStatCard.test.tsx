import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { PULSE_GRID_CLASS, ProfilePulseGrid, ProfileStatCard } from "./ProfileStatCard"

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
        title="Session time"
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

  it("renders a small count when the card sits in a half column", () => {
    renderWithProviders(<ProfileStatCard size="small" title="Runs" value={11} />)

    expect(screen.getByText("11").className).toMatch(/text-3xl/)
    expect(screen.getByText("11").className).not.toMatch(/text-5xl/)
  })

  it("centers the card body on both axes instead of top-stacking", () => {
    const { container } = renderWithProviders(
      <ProfileStatCard title="Sessions" value={5} />,
    )

    const card = container.firstElementChild
    expect(card?.className).toMatch(/h-full/)
    expect(card?.className).toMatch(/flex/)
    expect(card?.className).toMatch(/flex-col/)

    const body = screen.getByText("5").parentElement
    expect(body?.className).toMatch(/flex-1/)
    expect(body?.className).toMatch(/justify-center/)
    expect(body?.className).toMatch(/items-center/)
    expect(body?.className).toMatch(/text-center/)
  })

  it("keeps three pulse columns on a phone-width grid", () => {
    expect(PULSE_GRID_CLASS).toMatch(/grid-cols-3/)
    expect(PULSE_GRID_CLASS).not.toMatch(/sm:grid-cols/)
    expect(PULSE_GRID_CLASS).not.toMatch(/lg:grid-cols/)

    const { container } = renderWithProviders(
      <ProfilePulseGrid>
        <ProfileStatCard title="A" value={1} />
        <ProfileStatCard title="B" value={2} />
        <ProfileStatCard title="C" value={3} />
      </ProfilePulseGrid>,
    )

    expect(container.firstElementChild).toHaveClass("grid-cols-3")
  })

  it("drops nested card chrome so stats sit as type on the section", () => {
    const { container } = renderWithProviders(
      <ProfileStatCard title="Sessions" value={5} />,
    )

    const card = container.firstElementChild
    expect(card).toHaveClass("border-0")
    expect(card).toHaveClass("shadow-none")
    expect(card).toHaveClass("bg-transparent")
    expect(card).not.toHaveClass("border")
    expect(card).not.toHaveClass("shadow-xs")
    expect(card).not.toHaveAttribute("role")
  })
})
