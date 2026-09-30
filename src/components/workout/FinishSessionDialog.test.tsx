import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { FinishSessionDialog } from "./FinishSessionDialog"

describe("FinishSessionDialog", () => {
  it("shows the session title and the confirm body", () => {
    renderWithProviders(
      <FinishSessionDialog
        open
        body="You have 1 skipped set. Finish anyway?"
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByText("Finish session?")).toBeInTheDocument()
    expect(
      screen.getByText("You have 1 skipped set. Finish anyway?"),
    ).toBeInTheDocument()
  })

  it("confirms the finish", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderWithProviders(
      <FinishSessionDialog
        open
        body="Finish anyway?"
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Finish" }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("dismisses without finishing on cancel", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    renderWithProviders(
      <FinishSessionDialog
        open
        body="Finish anyway?"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
