import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { PathChoiceStep } from "./PathChoiceStep"

describe("PathChoiceStep", () => {
  it("renders both path cards", () => {
    renderWithProviders(
      <PathChoiceStep onGuided={vi.fn()} onSelfDirected={vi.fn()} />,
    )
    expect(screen.getByText("Recommend me a program")).toBeInTheDocument()
    expect(screen.getByText("I'll build my own")).toBeInTheDocument()
  })

  it("calls onGuided when guided card is clicked", async () => {
    const onGuided = vi.fn()
    renderWithProviders(
      <PathChoiceStep onGuided={onGuided} onSelfDirected={vi.fn()} />,
    )
    await userEvent.click(screen.getByText("Recommend me a program"))
    expect(onGuided).toHaveBeenCalledOnce()
  })

  it("calls onSelfDirected when self-directed card is clicked", async () => {
    const onSelfDirected = vi.fn()
    renderWithProviders(
      <PathChoiceStep onGuided={vi.fn()} onSelfDirected={onSelfDirected} />,
    )
    await userEvent.click(screen.getByText("I'll build my own"))
    expect(onSelfDirected).toHaveBeenCalledOnce()
  })

  it("activates guided card with Enter key", async () => {
    const onGuided = vi.fn()
    renderWithProviders(
      <PathChoiceStep onGuided={onGuided} onSelfDirected={vi.fn()} />,
    )
    const card = screen.getByText("Recommend me a program").closest("[role='button']") as HTMLElement
    card.focus()
    await userEvent.keyboard("{Enter}")
    expect(onGuided).toHaveBeenCalledOnce()
  })

  it("activates self-directed card with Space key", async () => {
    const onSelfDirected = vi.fn()
    renderWithProviders(
      <PathChoiceStep onGuided={vi.fn()} onSelfDirected={onSelfDirected} />,
    )
    const card = screen.getByText("I'll build my own").closest("[role='button']") as HTMLElement
    card.focus()
    await userEvent.keyboard(" ")
    expect(onSelfDirected).toHaveBeenCalledOnce()
  })
})
