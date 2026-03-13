import { vi, describe, it, expect, beforeEach } from "vitest"
import { screen, fireEvent, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { FeedbackSheet } from "./FeedbackSheet"

vi.mock("./FeedbackForm", () => ({
  FeedbackForm: (props: { onSuccess: () => void }) => (
    <button onClick={props.onSuccess} data-testid="mock-submit">
      Submit
    </button>
  ),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  exerciseId: "ex-1",
  sourceScreen: "workout" as const,
  onSuccess: vi.fn(),
}

describe("FeedbackSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders form when open", () => {
    renderWithProviders(<FeedbackSheet {...baseProps} />)
    expect(screen.getByText("Send feedback")).toBeInTheDocument()
    expect(screen.getByTestId("mock-submit")).toBeInTheDocument()
  })

  it("does not render content when closed", () => {
    renderWithProviders(<FeedbackSheet {...baseProps} open={false} />)
    expect(screen.queryByText("Send feedback")).not.toBeInTheDocument()
  })

  it("shows success view after form submission", async () => {
    const user = userEvent.setup()
    renderWithProviders(<FeedbackSheet {...baseProps} />)

    await user.click(screen.getByTestId("mock-submit"))

    expect(screen.queryByTestId("mock-submit")).not.toBeInTheDocument()
    expect(screen.getByText(/thank you/i)).toBeInTheDocument()
  })

  it("success view has animate-success-flash class", async () => {
    const user = userEvent.setup()
    renderWithProviders(<FeedbackSheet {...baseProps} />)

    await user.click(screen.getByTestId("mock-submit"))

    const successContainer = screen.getByText(/thank you/i).parentElement!
    expect(successContainer.className).toContain("animate-success-flash")
  })

  it("success container has onAnimationEnd handler wired up", async () => {
    const user = userEvent.setup()
    renderWithProviders(<FeedbackSheet {...baseProps} />)

    await user.click(screen.getByTestId("mock-submit"))

    const successContainer = document.querySelector(".animate-success-flash")
    expect(successContainer).toBeTruthy()
    expect(successContainer?.className).toContain("animate-success-flash")
  })
})
