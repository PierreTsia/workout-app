import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ErrorFallback } from "./ErrorFallback"

const testError = new Error("Supabase exploded")
testError.stack = "Error: Supabase exploded\n    at WorkoutPage.tsx:42"

describe("ErrorFallback", () => {
  describe('variant="page"', () => {
    it("renders title and description", () => {
      renderWithProviders(<ErrorFallback error={testError} />)
      expect(screen.getByText("Dropped the bar")).toBeInTheDocument()
      expect(screen.getByText(/crashed mid-set/)).toBeInTheDocument()
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

    it("shows stack trace toggle in dev mode", async () => {
      renderWithProviders(<ErrorFallback error={testError} />)
      const toggle = screen.getByText("Stack trace")
      expect(toggle).toBeInTheDocument()

      await userEvent.click(toggle)
      expect(screen.getByText(/Supabase exploded/)).toBeInTheDocument()
      expect(screen.getByText(/WorkoutPage\.tsx:42/)).toBeInTheDocument()
    })
  })

  describe('variant="inline"', () => {
    it("renders compact error with title", () => {
      renderWithProviders(
        <ErrorFallback error={testError} variant="inline" />,
      )
      expect(screen.getByText("Dropped the bar")).toBeInTheDocument()
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
  })
})
