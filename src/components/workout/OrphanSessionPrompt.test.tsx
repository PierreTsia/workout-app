import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import type { RecentOrphan } from "@/hooks/useOrphanSessionClose"
import { OrphanSessionPrompt } from "./OrphanSessionPrompt"

const ORPHAN: RecentOrphan = {
  id: "s1",
  workoutDayId: "day-1",
  workoutLabelSnapshot: "Push",
  startedAt: "2026-01-01T10:00:00.000Z",
  cycleId: "cycle-1",
  lastSetAt: "2026-01-01T11:00:00.000Z",
}

function render(overrides: Partial<RecentOrphan> = {}) {
  const props = {
    orphan: { ...ORPHAN, ...overrides },
    onResume: vi.fn(),
    onFinish: vi.fn(),
    onDismiss: vi.fn(),
  }
  renderWithProviders(<OrphanSessionPrompt {...props} />)
  return props
}

describe("OrphanSessionPrompt", () => {
  it("renders the contract copy when there is a recent orphan", () => {
    render()

    expect(
      screen.getByText("Your last session wasn't finished"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Resume it, or finish it to save your sets?"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Resume it" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Finish it" }),
    ).toBeInTheDocument()
  })

  it("renders nothing without an orphan", () => {
    renderWithProviders(
      <OrphanSessionPrompt
        orphan={null}
        onResume={vi.fn()}
        onFinish={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    expect(
      screen.queryByText("Your last session wasn't finished"),
    ).not.toBeInTheDocument()
  })

  it("wires Resume, Finish and dismiss", async () => {
    const user = userEvent.setup()
    const props = render()

    await user.click(screen.getByRole("button", { name: "Resume it" }))
    expect(props.onResume).toHaveBeenCalledOnce()

    await user.click(screen.getByRole("button", { name: "Finish it" }))
    expect(props.onFinish).toHaveBeenCalledOnce()

    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(props.onDismiss).toHaveBeenCalledOnce()
  })
})
