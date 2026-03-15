import React from "react"
import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { RirDrawer } from "./RirDrawer"

let capturedOnOpenChange: ((open: boolean) => void) | undefined

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
  }) => {
    capturedOnOpenChange = onOpenChange
    return open ? <div data-testid="drawer-root">{children}</div> : null
  },
  DrawerContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DrawerDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}))

const SET_INFO = { setNumber: 1, reps: "10", weight: "60", unit: "kg" }

describe("RirDrawer", () => {
  it("renders all 5 RIR toggle buttons when open", () => {
    renderWithProviders(
      <RirDrawer open setInfo={SET_INFO} onConfirm={vi.fn()} />,
    )

    expect(screen.getByText("4+")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("0")).toBeInTheDocument()
  })

  it("renders nothing when open is false", () => {
    renderWithProviders(
      <RirDrawer open={false} setInfo={SET_INFO} onConfirm={vi.fn()} />,
    )

    expect(screen.queryByTestId("drawer-root")).not.toBeInTheDocument()
  })

  it("displays the set info context line", () => {
    renderWithProviders(
      <RirDrawer open setInfo={SET_INFO} onConfirm={vi.fn()} />,
    )

    expect(screen.getByText("#1 set: 10 × 60 kg")).toBeInTheDocument()
  })

  it("calls onConfirm with default RIR (2) when Confirm is clicked without changing selection", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderWithProviders(
      <RirDrawer open setInfo={SET_INFO} onConfirm={onConfirm} />,
    )

    await user.click(screen.getByRole("button", { name: "Confirm" }))

    expect(onConfirm).toHaveBeenCalledWith(2)
  })

  it("calls onConfirm with selected RIR after toggling a different value", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderWithProviders(
      <RirDrawer open setInfo={SET_INFO} onConfirm={onConfirm} />,
    )

    await user.click(screen.getByText("4+"))
    await user.click(screen.getByRole("button", { name: "Confirm" }))

    expect(onConfirm).toHaveBeenCalledWith(4)
  })

  it("calls onConfirm with current selection on dismiss (onOpenChange false)", async () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <RirDrawer open setInfo={SET_INFO} onConfirm={onConfirm} />,
    )

    expect(capturedOnOpenChange).toBeDefined()
    capturedOnOpenChange!(false)

    expect(onConfirm).toHaveBeenCalledWith(2)
  })
})
