import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { LeftoverStepper } from "@/components/workout/LeftoverStepper"

describe("LeftoverStepper", () => {
  it("clamps leftover between 0 and the prescribed amount", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderWithProviders(
      <LeftoverStepper max={10} initial={3} unit="reps" onConfirm={onConfirm} />,
    )

    expect(screen.getByText("3")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /decrease/i }))
    expect(screen.getByText("2")).toBeInTheDocument()

    const inc = screen.getByRole("button", { name: /increase/i })
    await user.click(inc)
    await user.click(inc)
    expect(screen.getByText("4")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /log leftover/i }))
    expect(onConfirm).toHaveBeenCalledWith(4)
  })
})
