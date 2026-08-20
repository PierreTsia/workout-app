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

const CEREMONY_BUTTONS = [
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

const BODYWEIGHT_BUTTONS = [
  "Pompes ladder",
  "Tractions diamond",
  "Squat diamond",
  "Expert diamond",
  "Hard Time diamond",
  "BW mixed",
] as const

const BUTTON_NAMES = [...CEREMONY_BUTTONS, ...BODYWEIGHT_BUTTONS] as const

describe("UnlockOverlayPlaygroundPage", () => {
  afterEach(() => {
    const store = getDefaultStore()
    store.set(achievementUnlockQueueAtom, [])
    store.set(achievementShownIdsAtom, new Set())
  })

  it("renders the ceremony fixtures and the six bodyweight buttons", () => {
    renderWithProviders(<UnlockOverlayPlaygroundPage />)

    BUTTON_NAMES.forEach((name) => {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    })
  })

  it("queues a five-rank Pompes overflow batch with badge icons", async () => {
    const user = userEvent.setup()
    renderWithProviders(<UnlockOverlayPlaygroundPage />)

    await user.click(screen.getByRole("button", { name: "Pompes ladder" }))

    const queue = getDefaultStore().get(achievementUnlockQueueAtom)
    expect(queue.map((g) => g.rank)).toEqual([
      "bronze",
      "silver",
      "gold",
      "platinum",
      "diamond",
    ])
    expect(queue.every((g) => g.group_slug === "push_ups")).toBe(true)
    expect(
      queue.every((g) => g.icon_asset_url?.includes("/badge-icons/push_ups_")),
    ).toBe(true)
  })

  it("queues a mixed Bodyweight Trinity batch", async () => {
    const user = userEvent.setup()
    renderWithProviders(<UnlockOverlayPlaygroundPage />)

    await user.click(screen.getByRole("button", { name: "BW mixed" }))

    const queue = getDefaultStore().get(achievementUnlockQueueAtom)
    expect(queue.map((g) => g.group_slug)).toEqual([
      "push_ups",
      "pull_ups",
      "bw_squats",
      "bw_expert",
      "hundred_a_day",
    ])
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
