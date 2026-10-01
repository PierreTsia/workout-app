import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { SessionNote } from "./SessionNote"

describe("SessionNote", () => {
  it("saves the typed note on blur", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderWithProviders(<SessionNote onSave={onSave} />)

    await user.type(
      screen.getByPlaceholderText("One line about your session (optional)"),
      "bad sleep",
    )
    await user.tab()

    expect(onSave).toHaveBeenCalledWith("bad sleep")
  })

  it("does not save when the note is left unchanged", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderWithProviders(<SessionNote onSave={onSave} />)

    await user.click(
      screen.getByPlaceholderText("One line about your session (optional)"),
    )
    await user.tab()

    expect(onSave).not.toHaveBeenCalled()
  })
})
