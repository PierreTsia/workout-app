import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { DeviationReasonSheet } from "./DeviationReasonSheet"

const SET_INFO = {
  setNumber: 2,
  prescribed: "80",
  actual: "72.5",
  unit: "kg",
  weightChanged: true,
  repsChanged: false,
  prescribedReps: "10",
  actualReps: "10",
}

const REASON_LABELS = [
  "Pain or discomfort",
  "Fatigue",
  "Felt strong",
  "Equipment unavailable",
  "Form",
  "Other",
]

describe("DeviationReasonSheet", () => {
  it("renders the closed vocabulary and keeps Save disabled until something is set", () => {
    renderWithProviders(
      <DeviationReasonSheet open setInfo={SET_INFO} onResolve={vi.fn()} />,
    )

    expect(screen.getByText("Why this weight?")).toBeInTheDocument()
    for (const label of REASON_LABELS) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("resolves the selected reason on Save", async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn()
    renderWithProviders(
      <DeviationReasonSheet open setInfo={SET_INFO} onResolve={onResolve} />,
    )

    await user.click(screen.getByRole("radio", { name: "Fatigue" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onResolve).toHaveBeenCalledWith("fatigue", null)
  })

  it("resolves a null reason on Skip — the skip is data", async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn()
    renderWithProviders(
      <DeviationReasonSheet open setInfo={SET_INFO} onResolve={onResolve} />,
    )

    await user.click(screen.getByRole("button", { name: "Skip" }))

    expect(onResolve).toHaveBeenCalledWith(null, null)
  })

  it("allows a note-only resolution", async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn()
    renderWithProviders(
      <DeviationReasonSheet open setInfo={SET_INFO} onResolve={onResolve} />,
    )

    await user.type(
      screen.getByPlaceholderText("Add a note (optional)"),
      "bad sleep",
    )
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onResolve).toHaveBeenCalledWith(null, "bad sleep")
  })
})
