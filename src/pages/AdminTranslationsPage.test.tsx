import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders, mockQueryResult } from "@/test/utils"
import { AdminTranslationsPage } from "@/pages/AdminTranslationsPage"
import { useTranslationReviewQueue } from "@/hooks/useTranslationReviewQueue"
import type { TranslationReviewRow } from "@/hooks/useTranslationReviewQueue"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))
vi.mock("@/hooks/useTranslationReviewQueue", () => ({
  useTranslationReviewQueue: vi.fn(),
  TRANSLATION_REVIEW_QUEUE_KEY: "translations-for-review",
}))

const instructions = {
  setup: ["Mise en place."],
  movement: ["Mouvement."],
  breathing: ["Respiration."],
  common_mistakes: ["Erreur."],
}

const makeRow = (
  overrides: Partial<TranslationReviewRow> & Pick<TranslationReviewRow, "id" | "name">,
): TranslationReviewRow => ({
  name_en: null,
  instructions,
  instructions_en: {
    setup: ["Set up."],
    movement: ["Move."],
    breathing: ["Breathe."],
    common_mistakes: ["Mistake."],
  },
  instructions_en_status: "clean",
  instructions_en_audit: null,
  logged_sets: 0,
  ...overrides,
})

// The RPC's order: flagged first even when it has never been logged, then the
// clean rows by reading exposure. The page must render it as given.
const queueInRpcOrder: TranslationReviewRow[] = [
  makeRow({
    id: "flagged-never-logged",
    name: "Cat-cow",
    instructions_en_status: "flagged",
    logged_sets: 0,
  }),
  makeRow({ id: "clean-heavy", name: "Bench press", logged_sets: 152 }),
  makeRow({ id: "clean-light", name: "Band pull-apart", logged_sets: 3 }),
]

const mockedQueue = vi.mocked(useTranslationReviewQueue)

beforeEach(() => {
  mockedQueue.mockReturnValue(
    mockQueryResult(queueInRpcOrder) as ReturnType<
      typeof useTranslationReviewQueue
    >,
  )
})

describe("AdminTranslationsPage", () => {
  it("opens on the first row the RPC returned", () => {
    renderWithProviders(<AdminTranslationsPage />)

    expect(screen.getByRole("heading", { name: "Cat-cow" })).toBeInTheDocument()
    expect(screen.getByText("1/3")).toBeInTheDocument()
  })

  // The ordering criterion, at the level this page is responsible for: the
  // never-logged flagged row leads, and no client-side re-sort sinks it below
  // the clean row with 152 logged sets.
  it("walks the queue in the order it was given, flagged first", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminTranslationsPage />)

    expect(screen.getByRole("heading", { name: "Cat-cow" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /next/i }))
    expect(
      screen.getByRole("heading", { name: "Bench press" }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /next/i }))
    expect(
      screen.getByRole("heading", { name: "Band pull-apart" }),
    ).toBeInTheDocument()
  })

  // The card owns the shortcut, the page owns the position. Neither test can
  // see the seam on its own, so this one drives the real pair.
  it("moves on when the reviewer skips from the keyboard", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminTranslationsPage />)

    await user.keyboard("{ArrowRight}")

    expect(
      screen.getByRole("heading", { name: "Bench press" }),
    ).toBeInTheDocument()
  })

  it("goes back the way it came", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminTranslationsPage />)

    await user.click(screen.getByRole("button", { name: /next/i }))
    await user.click(screen.getByRole("button", { name: /previous/i }))

    expect(screen.getByRole("heading", { name: "Cat-cow" })).toBeInTheDocument()
  })

  it("stops at both ends of the queue", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminTranslationsPage />)

    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: /next/i }))
    await user.click(screen.getByRole("button", { name: /next/i }))

    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled()
  })

  it("shows the empty state when the queue is exhausted", () => {
    mockedQueue.mockReturnValue(
      mockQueryResult([]) as ReturnType<typeof useTranslationReviewQueue>,
    )
    renderWithProviders(<AdminTranslationsPage />)

    expect(
      screen.getByText("No translation left to review!"),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /next/i })).toBeNull()
  })

  it("translates its own shell", () => {
    renderWithProviders(<AdminTranslationsPage />, { locale: "fr" })

    expect(
      screen.getByRole("heading", { name: "Relecture des traductions" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /suivant/i })).toBeInTheDocument()
  })
})
