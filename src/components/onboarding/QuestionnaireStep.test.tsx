import { describe, it, expect, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { QuestionnaireStep } from "./QuestionnaireStep"

function renderStep(onNext = vi.fn()) {
  return { onNext, ...renderWithProviders(<QuestionnaireStep onNext={onNext} />) }
}

describe("QuestionnaireStep", () => {
  it("renders all section labels", () => {
    renderStep()
    expect(screen.getByText("About you")).toBeInTheDocument()
    expect(screen.getByText("Gender")).toBeInTheDocument()
    expect(screen.getByText("Primary goal")).toBeInTheDocument()
    expect(screen.getByText("Experience level")).toBeInTheDocument()
    expect(screen.getByText("Available equipment")).toBeInTheDocument()
    expect(screen.getByText("Training days per week")).toBeInTheDocument()
    expect(screen.getByText("Session duration")).toBeInTheDocument()
  })

  it("renders age and weight inputs", () => {
    renderStep()
    expect(screen.getByPlaceholderText("e.g. 28")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("e.g. 75")).toBeInTheDocument()
  })

  it("shows validation errors on submit with empty required fields", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(screen.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(screen.getAllByText("Required").length).toBeGreaterThanOrEqual(1)
    })
  })

  it("calls onNext with correct output after filling all fields", async () => {
    const user = userEvent.setup()
    const { onNext } = renderStep()

    // ToggleGroup type="single" renders items as role="radio"
    await user.click(screen.getByRole("radio", { name: /Male/ }))
    await user.type(screen.getByPlaceholderText("e.g. 28"), "30")
    await user.type(screen.getByPlaceholderText("e.g. 75"), "80")
    await user.click(screen.getByRole("radio", { name: /Muscle growth/ }))
    await user.click(screen.getByRole("radio", { name: /Intermediate/ }))
    await user.click(screen.getByRole("radio", { name: /Full gym/ }))

    await user.click(screen.getByRole("button", { name: "Next" }))

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledOnce()
    })

    const output = onNext.mock.calls[0][0]
    expect(output).toEqual({
      gender: "male",
      age: 30,
      weight: 80,
      goal: "hypertrophy",
      experience: "intermediate",
      equipment: "gym",
      training_days_per_week: 3,
      session_duration_minutes: 60,
    })
  })

  it("selects toggle group items correctly", async () => {
    const user = userEvent.setup()
    renderStep()

    const femaleBtn = screen.getByRole("radio", { name: /Female/ })
    await user.click(femaleBtn)
    expect(femaleBtn).toHaveAttribute("data-state", "on")
  })
})
