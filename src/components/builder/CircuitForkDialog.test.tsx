import { vi, describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { CircuitForkDialog } from "@/components/builder/CircuitForkDialog"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

describe("CircuitForkDialog", () => {
  it("shows the locked copy and cancel does not confirm a write", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()

    const { rerender, i18nInstance } = renderWithProviders(
      <CircuitForkDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />,
    )

    expect(
      screen.getByRole("alertdialog", { name: /this will no longer be cindy/i }),
    ).toBeInTheDocument()

    await i18nInstance.changeLanguage("fr")
    rerender(
      <CircuitForkDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />,
    )

    expect(
      screen.getByRole("alertdialog", { name: /ça ne sera plus cindy/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/tes scores déjà faits restent/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/cette séance ne comptera plus/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/copie privée/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /annuler/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
