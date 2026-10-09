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

describe("SyncStatusChip", () => {
  afterEach(() => {
    setOnline(true)
  })

  it("renders nothing while idle and online", () => {
    setOnline(true)
    renderWithProviders(<SyncStatusChip />)

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("shows a grey dot when offline while idle", () => {
    setOnline(false)
    renderWithProviders(<SyncStatusChip />)

    const dot = screen.getByRole("status", { name: "Offline" })
    expect(dot).toHaveClass("rounded-full")
    expect(dot).toHaveClass("bg-muted-foreground")
  })

  it("shows an amber, pulsing dot while syncing", () => {
    setOnline(true)
    const { store } = renderWithProviders(<SyncStatusChip />)

    act(() => store.set(syncStatusAtom, "syncing"))

    const dot = screen.getByRole("status", { name: "Syncing…" })
    expect(dot).toHaveClass("bg-amber-500")
    expect(dot).toHaveClass("animate-pulse")
  })

  it("shows a green dot once synced", () => {
    setOnline(true)
    const { store } = renderWithProviders(<SyncStatusChip />)

    act(() => store.set(syncStatusAtom, "synced"))

    const dot = screen.getByRole("status", { name: "Synced" })
    expect(dot).toHaveClass("bg-green-500")
  })

  it("shows a red dot when sync failed", () => {
    setOnline(true)
    const { store } = renderWithProviders(<SyncStatusChip />)

    act(() => store.set(syncStatusAtom, "failed"))

    const dot = screen.getByRole("status", { name: "Sync failed" })
    expect(dot).toHaveClass("bg-destructive")
  })
})
