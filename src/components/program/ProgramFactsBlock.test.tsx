import { describe, expect, it, vi } from "vitest"
import { screen, within } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import type { ProgramFacts } from "@/lib/programScore/types"
import { ProgramFactsBlock } from "./ProgramFactsBlock"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

function makeFacts(overrides: Partial<ProgramFacts> = {}): ProgramFacts {
  return {
    dayCount: 6,
    setCount: 116,
    circuitCount: 0,
    circuitModes: { amrap: 0, rounds: 0 },
    mix: { free: 51, machine: 59, bodyweight: 6, other: 0 },
    ...overrides,
  }
}

describe("ProgramFactsBlock", () => {
  it("shows days, sets, and circuits as separate stats, not one blob", () => {
    renderWithProviders(<ProgramFactsBlock facts={makeFacts()} />)

    const stats = screen.getAllByRole("list")[0]
    expect(within(stats).getByText("6")).toBeInTheDocument()
    expect(within(stats).getByText("116")).toBeInTheDocument()
    expect(within(stats).getByText("0")).toBeInTheDocument()
    expect(within(stats).getByText("Days")).toBeInTheDocument()
    expect(within(stats).getByText("Sets")).toBeInTheDocument()
    expect(within(stats).getByText("Circuits")).toBeInTheDocument()
    expect(
      screen.queryByText("6 days · 116 sets · 0 circuits"),
    ).not.toBeInTheDocument()
  })

  it("hides empty mix buckets and names the rest on the bar", () => {
    renderWithProviders(<ProgramFactsBlock facts={makeFacts()} />)

    expect(
      screen.getByRole("img", {
        name: "Free weights 51 · Machines 59 · Bodyweight 6",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Free weights")).toBeInTheDocument()
    expect(screen.getByText("51")).toBeInTheDocument()
    expect(screen.getByText("Machines")).toBeInTheDocument()
    expect(screen.getByText("59")).toBeInTheDocument()
    expect(screen.getByText("Bodyweight")).toBeInTheDocument()
    expect(screen.queryByText("Other")).not.toBeInTheDocument()
  })
})
