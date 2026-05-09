import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ErrorFallback } from "./ErrorFallback"

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock("sonner", async () => {
  const actual = await vi.importActual<typeof import("sonner")>("sonner")
  return {
    ...actual,
    toast: {
      success: (...args: unknown[]) => toastSuccess(...args),
      error: (...args: unknown[]) => toastError(...args),
    },
  }
})

const testError = new Error("Supabase exploded")
testError.stack = "Error: Supabase exploded\n    at WorkoutPage.tsx:42"

beforeEach(() => {
  toastSuccess.mockReset()
  toastError.mockReset()
})

describe("ErrorFallback", () => {
  describe('variant="page"', () => {
    it("renders title, description and the error message in prod", () => {
      renderWithProviders(<ErrorFallback error={testError} />)
      expect(screen.getByText("Dropped the bar")).toBeInTheDocument()
      expect(screen.getByText(/crashed mid-set/)).toBeInTheDocument()
      expect(screen.getByText("Supabase exploded")).toBeInTheDocument()
    })

    it("renders the error id badge with the provided id", () => {
      renderWithProviders(
        <ErrorFallback error={testError} errorId="err_abc123" />,
      )
      expect(screen.getByText("Error ID:")).toBeInTheDocument()
      expect(screen.getByText("err_abc123")).toBeInTheDocument()
    })

    it("derives an error id when none is provided", () => {
      renderWithProviders(<ErrorFallback error={testError} />)
      const monoSpans = screen.getAllByText(/^err_[0-9a-f]{6}$/)
      expect(monoSpans.length).toBeGreaterThan(0)
    })

    it("renders retry button that calls resetErrorBoundary", async () => {
      const reset = vi.fn()
      renderWithProviders(
        <ErrorFallback error={testError} resetErrorBoundary={reset} />,
      )
      await userEvent.click(screen.getByRole("button", { name: "Retry" }))
      expect(reset).toHaveBeenCalledOnce()
    })

    it("renders go-home link pointing to /", () => {
      renderWithProviders(<ErrorFallback error={testError} />)
      const link = screen.getByRole("link", { name: "Back to workout" })
      expect(link).toHaveAttribute("href", "/")
    })

    it("does not render retry button when resetErrorBoundary is not provided", () => {
      renderWithProviders(<ErrorFallback error={testError} />)
      expect(
        screen.queryByRole("button", { name: "Retry" }),
      ).not.toBeInTheDocument()
    })

    it("toggles technical details and shows stack + component stack", async () => {
      renderWithProviders(
        <ErrorFallback
          error={testError}
          componentStack="    at <Foo />\n    at <Bar />"
        />,
      )

      const toggle = screen.getByRole("button", { name: /Technical details/ })
      await userEvent.click(toggle)

      expect(screen.getByText(/WorkoutPage\.tsx:42/)).toBeInTheDocument()
      expect(screen.getByText(/at <Foo \/>/)).toBeInTheDocument()
    })

    it("copy button writes the markdown report to the clipboard", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      })

      renderWithProviders(
        <ErrorFallback error={testError} errorId="err_abc123" />,
      )

      await userEvent.click(screen.getByRole("button", { name: /Copy report/ }))

      await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
      const payload = writeText.mock.calls[0]![0] as string
      expect(payload).toContain("err_abc123")
      expect(payload).toContain("Supabase exploded")
      expect(payload).toContain("WorkoutPage.tsx:42")
      expect(toastSuccess).toHaveBeenCalled()
    })

    it("shows an error toast when clipboard fails", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: () => Promise.reject(new Error("denied")),
        },
        configurable: true,
      })
      Object.defineProperty(document, "execCommand", {
        value: () => false,
        configurable: true,
      })

      renderWithProviders(<ErrorFallback error={testError} />)
      await userEvent.click(screen.getByRole("button", { name: /Copy report/ }))

      await waitFor(() => expect(toastError).toHaveBeenCalled())
    })
  })

  describe('variant="inline"', () => {
    it("renders compact error with title and message", () => {
      renderWithProviders(
        <ErrorFallback error={testError} variant="inline" />,
      )
      expect(screen.getByText("Dropped the bar")).toBeInTheDocument()
      expect(screen.getByText("Supabase exploded")).toBeInTheDocument()
    })

    it("renders retry button when resetErrorBoundary is provided", async () => {
      const reset = vi.fn()
      renderWithProviders(
        <ErrorFallback
          error={testError}
          resetErrorBoundary={reset}
          variant="inline"
        />,
      )
      await userEvent.click(screen.getByRole("button", { name: "Retry" }))
      expect(reset).toHaveBeenCalledOnce()
    })

    it("does not render go-home link", () => {
      renderWithProviders(
        <ErrorFallback error={testError} variant="inline" />,
      )
      expect(
        screen.queryByRole("link", { name: "Back to workout" }),
      ).not.toBeInTheDocument()
    })

    it("renders the error id badge", () => {
      renderWithProviders(
        <ErrorFallback
          error={testError}
          errorId="err_inline1"
          variant="inline"
        />,
      )
      expect(screen.getByText("err_inline1")).toBeInTheDocument()
    })
  })
})
