import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { OpenSessionDialog } from "./OpenSessionDialog"

describe("OpenSessionDialog", () => {
  it("offers Finish and Resume, and nothing that starts anyway", async () => {
    const onFinish = vi.fn()
    const onResume = vi.fn()
    renderWithProviders(
      <OpenSessionDialog open onFinish={onFinish} onResume={onResume} />,
    )

    expect(screen.getByText("Unfinished session")).toBeInTheDocument()
    expect(
      screen.getByText("You have an unfinished session. Finish it, or resume it?"),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole("button", { name: /start/i }),
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Finish it" }))
    expect(onFinish).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole("button", { name: "Resume it" }))
    expect(onResume).toHaveBeenCalledTimes(1)
  })
})
