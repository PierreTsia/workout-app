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

/** The visible shape is the aria-hidden child; the wrapper carries the status role. */
function dotFor(label: string) {
  const status = screen.getByTestId("sync-status-dot")
  expect(status).toHaveTextContent(label)
  const dot = status.querySelector("[aria-hidden='true']")
  if (!dot) throw new Error("sync dot shape not rendered")
  return dot
}

describe("SyncStatusChip", () => {
  afterEach(() => {
    setOnline(true)
  })

  it("renders nothing while idle and online", () => {
    setOnline(true)
    renderWithProviders(<SyncStatusChip />)

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
    expect(dot).toHaveClass("bg-amber-500")
    expect(dot).toHaveClass("animate-pulse")
  })

  it("shows a filled green dot once synced", () => {
    setOnline(true)
    const { store } = renderWithProviders(<SyncStatusChip />)

    act(() => store.set(syncStatusAtom, "synced"))

    const dot = dotFor("Synced")
    expect(dot).toHaveClass("bg-green-500")
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
