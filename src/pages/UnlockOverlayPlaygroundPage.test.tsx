import { afterEach, describe, expect, it, vi } from "vitest"
import { getDefaultStore } from "jotai"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import {
  achievementShownIdsAtom,
  achievementUnlockQueueAtom,
} from "@/store/atoms"
import { UnlockOverlayPlaygroundPage } from "./UnlockOverlayPlaygroundPage"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

const BUTTON_NAMES = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "2 overlap",
  "Burst 3",
  "Burst 4",
  "Overflow 5+",
] as const

describe("UnlockOverlayPlaygroundPage", () => {
  afterEach(() => {
    const store = getDefaultStore()
    store.set(achievementUnlockQueueAtom, [])
    store.set(achievementShownIdsAtom, new Set())
  })

  it("renders the nine fixture buttons", () => {
    renderWithProviders(<UnlockOverlayPlaygroundPage />)

    for (const name of BUTTON_NAMES) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }
  })

  it("puts a gold grant on the queue when Gold is clicked", async () => {
    const user = userEvent.setup()
    renderWithProviders(<UnlockOverlayPlaygroundPage />)

    await user.click(screen.getByRole("button", { name: "Gold" }))

    const queue = getDefaultStore().get(achievementUnlockQueueAtom)
    expect(queue).toHaveLength(1)
    expect(queue[0]?.rank).toBe("gold")
  })
})
