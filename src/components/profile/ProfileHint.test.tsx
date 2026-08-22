import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ProfileHint } from "./ProfileHint"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("ProfileHint", () => {
  it("keeps the pedagogical copy open after a click (tap)", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ProfileHint label="About Mix">
        Same-day types stack; the tallest slice won the day.
      </ProfileHint>,
    )

    await user.click(screen.getByRole("button", { name: "About Mix" }))
    expect(
      await screen.findByText(
        "Same-day types stack; the tallest slice won the day.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Same-day types stack; the tallest slice won the day.",
      ),
    ).toBeVisible()
  })
})
