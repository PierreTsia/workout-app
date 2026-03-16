import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ProgramCard } from "./ProgramCard"
import type { Program } from "@/types/onboarding"

const BASE_PROGRAM: Program = {
  id: "p-1",
  user_id: "u-1",
  name: "Test Program",
  template_id: "tpl-1",
  is_active: false,
  archived_at: null,
  created_at: "2026-03-15T10:00:00Z",
}

function renderCard(overrides = {}) {
  const defaultProps = {
    program: BASE_PROGRAM,
    isActive: false,
    isSessionActive: false,
    onActivate: vi.fn(),
    onArchive: vi.fn(),
    onEdit: vi.fn(),
    onDetails: vi.fn(),
    ...overrides,
  }
  renderWithProviders(<ProgramCard {...defaultProps} />)
  return defaultProps
}

describe("ProgramCard", () => {
  it("renders program name", () => {
    renderCard()
    expect(screen.getByText("Test Program")).toBeInTheDocument()
  })

  it("shows Active badge when active", () => {
    renderCard({ isActive: true })
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("hides action buttons when active", () => {
    renderCard({ isActive: true })
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument()
  })

  it("shows Activate and Archive for inactive program", () => {
    renderCard()
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument()
  })

  it("disables Activate when session is active", () => {
    renderCard({ isSessionActive: true })
    expect(screen.getByRole("button", { name: "Activate" })).toBeDisabled()
  })

  it("shows Unarchive for archived program", () => {
    renderCard({ program: { ...BASE_PROGRAM, archived_at: "2026-03-15T12:00:00Z" } })
    expect(screen.getByRole("button", { name: "Unarchive" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument()
  })

  it("shows Archived badge for archived program", () => {
    renderCard({ program: { ...BASE_PROGRAM, archived_at: "2026-03-15T12:00:00Z" } })
    expect(screen.getByText("Archived")).toBeInTheDocument()
  })

  it("calls onDetails when details link is clicked", async () => {
    const props = renderCard()
    await userEvent.setup().click(screen.getByText("Details"))
    expect(props.onDetails).toHaveBeenCalledOnce()
  })

  it("calls onActivate when Activate button is clicked", async () => {
    const props = renderCard()
    await userEvent.setup().click(screen.getByRole("button", { name: "Activate" }))
    expect(props.onActivate).toHaveBeenCalledOnce()
  })
})
