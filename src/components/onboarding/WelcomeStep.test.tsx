import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { WelcomeStep } from "./WelcomeStep"

describe("WelcomeStep", () => {
  it("renders title and description", () => {
    renderWithProviders(<WelcomeStep onNext={vi.fn()} />)
    expect(screen.getByText("Let's build your program")).toBeInTheDocument()
    expect(screen.getByText(/Answer a few questions/)).toBeInTheDocument()
  })

  it("calls onNext when Get Started is clicked", async () => {
    const onNext = vi.fn()
    renderWithProviders(<WelcomeStep onNext={onNext} />)
    await userEvent.click(screen.getByRole("button", { name: "Get Started" }))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
