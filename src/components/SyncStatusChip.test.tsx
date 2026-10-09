import { describe, it, expect, afterEach } from "vitest"
import { screen, act } from "@testing-library/react"
import { renderWithProviders } from "@/test/utils"
import { syncStatusAtom } from "@/store/atoms"
import { SyncStatusChip } from "./SyncStatusChip"

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => value,
  })
}

function dotFor(label: string) {
  expect(screen.getByRole("status")).toHaveTextContent(label)
  return screen.getByTestId("sync-status-dot")
}

describe("SyncStatusChip", () => {
  afterEach(() => {
    setOnline(true)
  })

  it("keeps the live region mounted but empty, and no dot, while idle and online", () => {
    setOnline(true)
    renderWithProviders(<SyncStatusChip />)

    expect(screen.getByRole("status")).toBeEmptyDOMElement()
    expect(screen.queryByTestId("sync-status-dot")).not.toBeInTheDocument()
  })

  it("shows a hollow ring when offline while idle", () => {
    setOnline(false)
    renderWithProviders(<SyncStatusChip />)

    const dot = dotFor("Offline")
    expect(dot).toHaveClass("rounded-full")
    expect(dot).toHaveClass("border-muted-foreground")
  })

  it("shows a pulsing dot while syncing", () => {
    setOnline(true)
    const { store } = renderWithProviders(<SyncStatusChip />)

    act(() => store.set(syncStatusAtom, "syncing"))

    const dot = dotFor("Syncing…")
    expect(dot).toHaveClass("bg-amber-600")
    expect(dot).toHaveClass("animate-pulse")
  })

  it("shows a filled green dot once synced", () => {
    setOnline(true)
    const { store } = renderWithProviders(<SyncStatusChip />)

    act(() => store.set(syncStatusAtom, "synced"))

    const dot = dotFor("Synced")
    expect(dot).toHaveClass("bg-green-600")
    expect(dot).toHaveClass("rounded-full")
  })

  it("shows a red square when sync failed", () => {
    setOnline(true)
    const { store } = renderWithProviders(<SyncStatusChip />)

    act(() => store.set(syncStatusAtom, "failed"))

    const dot = dotFor("Sync failed")
    expect(dot).toHaveClass("bg-destructive")
    expect(dot).toHaveClass("rounded-[2px]")
    expect(dot).not.toHaveClass("rounded-full")
  })
})
