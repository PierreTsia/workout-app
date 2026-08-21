import { describe, expect, it, vi } from "vitest"
import { screen, within } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { ProfileWindowProvider } from "@/components/profile/ProfileWindowContext"
import { RegularsBlock, type RegularsFixtureMode } from "./RegularsBlock"
import type { ProfileWindowKind } from "@/lib/profile/window"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

function renderRegulars(
  mode: RegularsFixtureMode,
  kind: ProfileWindowKind = "100",
) {
  return renderWithProviders(
    <ProfileWindowProvider kind={kind} setKind={() => undefined}>
      <RegularsBlock mode={mode} />
    </ProfileWindowProvider>,
  )
}

describe("RegularsBlock", () => {
  it("shows name and last evolution, not program pills", () => {
    renderRegulars("pierre")

    expect(screen.getByText("Squat")).toBeInTheDocument()
    expect(screen.getAllByText("+2 kg").length).toBeGreaterThan(0)
    expect(screen.queryByText("On program")).not.toBeInTheDocument()
    expect(screen.queryByText("Off program")).not.toBeInTheDocument()
  })

  it("shows empty copy when there are not enough logs", () => {
    renderRegulars("empty")

    expect(
      screen.getByText("Not enough logs in this period."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Squat")).not.toBeInTheDocument()
    expect(screen.queryByText("+2 kg")).not.toBeInTheDocument()
  })

  it("ranks 100d by rep count with Pull-up on top", () => {
    renderRegulars("pierre", "100")

    const heading = screen.getByRole("heading", { name: "Regulars" })
    const card = heading.closest(".bg-card")
    if (!card) throw new Error("expected Regulars card")
    const items = within(card).getAllByRole("listitem")
    expect(items).toHaveLength(8)
    expect(within(items[0]).getByText("Pull-up")).toBeInTheDocument()
    expect(within(items[0]).getByText("400")).toBeInTheDocument()
    expect(within(items[items.length - 1]).getByText("Walking lunge")).toBeInTheDocument()
    expect(within(card).getByText("Most logged · 100d")).toBeInTheDocument()
  })

  it("follows the window: 7d is a shorter list with Squat on top", () => {
    renderRegulars("pierre", "7")

    const heading = screen.getByRole("heading", { name: "Regulars" })
    const card = heading.closest(".bg-card")
    if (!card) throw new Error("expected Regulars card")
    const items = within(card).getAllByRole("listitem")
    expect(items).toHaveLength(5)
    expect(within(items[0]).getByText("Squat")).toBeInTheDocument()
    expect(within(items[0]).getByText("48")).toBeInTheDocument()
    expect(within(card).getByText("Most logged · 7d")).toBeInTheDocument()
    expect(screen.queryByText("Walking lunge")).not.toBeInTheDocument()
    expect(screen.queryByText("400")).not.toBeInTheDocument()
  })
})
