import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import { FeedbackForm } from "./FeedbackForm"

const mockSubmit = vi.fn()

vi.mock("@/hooks/useSubmitFeedback", () => ({
  useSubmitFeedback: () => ({
    submit: mockSubmit,
    isPending: false,
  }),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const PROPS = {
  exerciseId: "ex-1",
  sourceScreen: "workout" as const,
  onSuccess: vi.fn(),
}

function renderForm(user?: { email: string; id: string } | null) {
  const result = renderWithProviders(<FeedbackForm {...PROPS} />)
  if (user) {
    result.store.set(authAtom, user as any)
  }
  return result
}

function renderAuthenticatedForm() {
  const result = renderWithProviders(<FeedbackForm {...PROPS} />)
  act(() => {
    result.store.set(authAtom, { email: "test@example.com", id: "uid-1" } as any)
  })
  result.rerender(<FeedbackForm {...PROPS} />)
  return result
}

describe("FeedbackForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubmit.mockResolvedValue(undefined)
  })

  describe("rendering", () => {
    it("returns null when no user", () => {
      const { container } = renderForm(null)
      expect(container.innerHTML).toBe("")
    })

    it("shows 'Reporting as' with user email", () => {
      renderAuthenticatedForm()
      expect(screen.getByText(/reporting as test@example\.com/i)).toBeInTheDocument()
    })

    it("shows three toggle pills in Step 1", () => {
      renderAuthenticatedForm()
      expect(screen.getByRole("button", { name: /illustration/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /video/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /description/i })).toBeInTheDocument()
    })

    it("Step 2 is collapsed initially", () => {
      renderAuthenticatedForm()
      expect(screen.queryByText(/how is it wrong/i)).toBeInTheDocument()
      const step2Container = screen.getByText(/how is it wrong/i).closest("[class*='grid']")
      expect(step2Container).toHaveClass("grid-rows-[0fr]")
    })

    it("shows comment field", () => {
      renderAuthenticatedForm()
      expect(screen.getByPlaceholderText(/additional comment/i)).toBeInTheDocument()
    })
  })

  describe("Step 1 interaction", () => {
    it("clicking a pill toggles it active", async () => {
      const user = userEvent.setup()
      renderAuthenticatedForm()

      const illPill = screen.getByRole("button", { name: /illustration/i })
      await user.click(illPill)
      expect(illPill).toHaveClass("bg-primary")
    })

    it("selecting a pill reveals Step 2", async () => {
      const user = userEvent.setup()
      renderAuthenticatedForm()

      await user.click(screen.getByRole("button", { name: /illustration/i }))
      const step2Container = screen.getByText(/how is it wrong/i).closest("[class*='grid']")
      expect(step2Container).toHaveClass("grid-rows-[1fr]")
    })

    it("deselecting all pills collapses Step 2", async () => {
      const user = userEvent.setup()
      renderAuthenticatedForm()

      const pill = screen.getByRole("button", { name: /illustration/i })
      await user.click(pill)
      await user.click(pill)

      const step2Container = screen.getByText(/how is it wrong/i).closest("[class*='grid']")
      expect(step2Container).toHaveClass("grid-rows-[0fr]")
    })
  })

  describe("submission", () => {
    it("calls submit with correct payload on valid form", async () => {
      const user = userEvent.setup()
      renderAuthenticatedForm()

      await user.click(screen.getByRole("button", { name: /illustration/i }))

      const selectTrigger = screen.getByRole("combobox")
      await user.click(selectTrigger)
      await user.click(screen.getByText(/shows wrong exercise/i))

      await user.click(screen.getByRole("button", { name: /submit feedback/i }))

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1)
      })

      const payload = mockSubmit.mock.calls[0][0]
      expect(payload.exercise_id).toBe("ex-1")
      expect(payload.fields_reported).toContain("illustration")
      expect(payload.error_details.illustration).toContain("wrong_exercise")
    })

    it("calls onSuccess after successful submit", async () => {
      const user = userEvent.setup()
      renderAuthenticatedForm()

      await user.click(screen.getByRole("button", { name: /illustration/i }))
      const selectTrigger = screen.getByRole("combobox")
      await user.click(selectTrigger)
      await user.click(screen.getByText(/shows wrong exercise/i))
      await user.click(screen.getByRole("button", { name: /submit feedback/i }))

      await waitFor(() => {
        expect(PROPS.onSuccess).toHaveBeenCalled()
      })
    })
  })
})
