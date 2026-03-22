import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { PathChoiceStep } from "./PathChoiceStep"

describe("PathChoiceStep", () => {
  function renderStep() {
    return renderWithProviders(
      <PathChoiceStep onAI={vi.fn()} onTemplate={vi.fn()} onBlank={vi.fn()} />,
    )
  }

  it("renders all three path cards", () => {
    renderStep()
    expect(screen.getByText("AI Generate")).toBeInTheDocument()
    expect(screen.getByText("From template")).toBeInTheDocument()
    expect(screen.getByText("Start from scratch")).toBeInTheDocument()
  })

  it("calls onAI when AI card is clicked", async () => {
    const onAI = vi.fn()
    renderWithProviders(
      <PathChoiceStep onAI={onAI} onTemplate={vi.fn()} onBlank={vi.fn()} />,
    )
    await userEvent.click(screen.getByText("AI Generate"))
    expect(onAI).toHaveBeenCalledOnce()
  })

  it("calls onTemplate when template card is clicked", async () => {
    const onTemplate = vi.fn()
    renderWithProviders(
      <PathChoiceStep onAI={vi.fn()} onTemplate={onTemplate} onBlank={vi.fn()} />,
    )
    await userEvent.click(screen.getByText("From template"))
    expect(onTemplate).toHaveBeenCalledOnce()
  })

  it("calls onBlank when blank card is clicked", async () => {
    const onBlank = vi.fn()
    renderWithProviders(
      <PathChoiceStep onAI={vi.fn()} onTemplate={vi.fn()} onBlank={onBlank} />,
    )
    await userEvent.click(screen.getByText("Start from scratch"))
    expect(onBlank).toHaveBeenCalledOnce()
  })

  it("activates template card with Enter key", async () => {
    const onTemplate = vi.fn()
    renderWithProviders(
      <PathChoiceStep onAI={vi.fn()} onTemplate={onTemplate} onBlank={vi.fn()} />,
    )
    const card = screen.getByText("From template").closest("[role='button']") as HTMLElement
    card.focus()
    await userEvent.keyboard("{Enter}")
    expect(onTemplate).toHaveBeenCalledOnce()
  })

  it("activates blank card with Space key", async () => {
    const onBlank = vi.fn()
    renderWithProviders(
      <PathChoiceStep onAI={vi.fn()} onTemplate={vi.fn()} onBlank={onBlank} />,
    )
    const card = screen.getByText("Start from scratch").closest("[role='button']") as HTMLElement
    card.focus()
    await userEvent.keyboard(" ")
    expect(onBlank).toHaveBeenCalledOnce()
  })
})
