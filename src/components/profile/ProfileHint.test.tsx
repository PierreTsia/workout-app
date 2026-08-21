import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ProfileHint } from "./ProfileHint"

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

describe("ProfileHint", () => {
  it("shows the pedagogical copy on hover", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <TooltipProvider>
        <ProfileHint label="About Mix">
          Same-day types stack; the tallest slice won the day.
        </ProfileHint>
      </TooltipProvider>,
    )

    await user.hover(screen.getByRole("button", { name: "About Mix" }))
    expect(
      await screen.findByText(
        "Same-day types stack; the tallest slice won the day.",
      ),
    ).toBeInTheDocument()
  })
})
