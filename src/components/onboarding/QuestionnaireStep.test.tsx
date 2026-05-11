import { afterEach, beforeEach, describe, it, expect, vi, type Mock } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { QuestionnaireStep, type QuestionnaireStepProps } from "./QuestionnaireStep"

interface RenderStepOptions {
  onNext?: Mock
  error?: QuestionnaireStepProps["error"]
}

function renderStep(options: RenderStepOptions = {}) {
  const onNext = options.onNext ?? vi.fn()
  return {
    onNext,
    ...renderWithProviders(
      <QuestionnaireStep onNext={onNext} error={options.error} />,
    ),
  }
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: /Male/ }))
  await user.type(screen.getByPlaceholderText("e.g. 28"), "30")
  await user.type(screen.getByPlaceholderText("e.g. 75"), "80")
  await user.click(screen.getByRole("radio", { name: /Muscle growth/ }))
  await user.click(screen.getByRole("radio", { name: /Intermediate/ }))
  await user.click(screen.getByRole("radio", { name: /Full gym/ }))
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

    await fillRequiredFields(user)
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

  // Regression for #348 — Sentry caught an `UnhandledRejection` because
  // `onSubmit` was sync and dropped the promise from `onNext`. The fix
  // makes `onSubmit` async + try/catches the await on `onNext`, so the
  // rejection never reaches `window.onunhandledrejection`. We listen on
  // `window` because that's the exact mechanism Sentry's
  // `auto.browser.global_handlers.onunhandledrejection` integration
  // hooks into — same path as the production trace.
  describe("regression: #348 unhandled promise rejection", () => {
    const unhandled: unknown[] = []
    const onUnhandled = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason)
    }

    beforeEach(() => {
      unhandled.length = 0
      window.addEventListener("unhandledrejection", onUnhandled)
    })

    afterEach(() => {
      window.removeEventListener("unhandledrejection", onUnhandled)
    })

    it("does not leak an unhandled promise rejection when onNext rejects", async () => {
      const user = userEvent.setup()
      const onNext = vi.fn().mockRejectedValue(new Error("upsert failed"))
      renderStep({ onNext })

      await fillRequiredFields(user)
      await user.click(screen.getByRole("button", { name: "Next" }))

      await waitFor(() => {
        expect(onNext).toHaveBeenCalledOnce()
      })

      // Let several macrotasks pass so any unhandled rejection has a
      // chance to surface on `window.onunhandledrejection` (jsdom +
      // Node fire it on the next macrotask after the promise settles
      // unhandled).
      for (let tick = 0; tick < 5; tick++) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      expect(unhandled).toEqual([])
    })

    it("renders an error alert with the provided message when error is set", () => {
      renderStep({ error: { title: "Could not save", body: "Try again." } })

      const alert = screen.getByRole("alert")
      expect(alert).toHaveTextContent("Could not save")
      expect(alert).toHaveTextContent("Try again.")
    })

    it("does not render the error alert when error is null", () => {
      renderStep({ error: null })

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })
  })
})
