import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { ReviewAssistDialog } from "@/components/admin/translations/ReviewAssistDialog"
import type { ReviewSubject } from "@/lib/reviewAssist"

// The dialog itself never talks to Supabase — it hands the correction back to
// the card, which owns the one write path — but the stub is what keeps the
// module graph from reaching a client CI has no keys for.
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const SUBJECT: ReviewSubject = {
  name: "Développé couché",
  name_en: "Bench Press",
  instructions: {
    setup: ["Allongez-vous sur le banc.", "Écartez les mains à largeur d'épaules."],
    movement: ["Poussez la barre vers le haut."],
    breathing: ["Expirez à la poussée."],
    common_mistakes: ["Dos creusé."],
  },
  instructions_en: {
    setup: ["Lie back on the bench.", "Set your hands hip-width apart."],
    movement: ["Press the bar upward."],
    breathing: ["Exhale as you press."],
    common_mistakes: ["Arched lower back."],
  },
  instructions_en_audit: null,
}

const CORRECTED = {
  ...SUBJECT.instructions_en!,
  setup: ["Lie back on the bench.", "Set your hands shoulder-width apart."],
}

function open(onApply = vi.fn()) {
  const user = userEvent.setup()
  renderWithProviders(
    <ReviewAssistDialog
      subject={SUBJECT}
      open
      onOpenChange={vi.fn()}
      onApply={onApply}
      disabled={false}
    />,
  )
  return { user, onApply }
}

const paste = async (
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) => {
  await user.click(screen.getByRole("textbox", { name: /corrected json/i }))
  await user.paste(text)
  await user.click(screen.getByRole("button", { name: /check the correction/i }))
}

describe("ReviewAssistDialog paste-back", () => {
  // The whole point of the shape gate: an answer that is not an instruction
  // block must not reach the card, and the reviewer has to be told what to do
  // about it rather than watch the button do nothing.
  it("refuses a truncated answer with a message and applies nothing", async () => {
    const { user, onApply } = open()

    await paste(user, '{"setup": ["Lie back on the bench.", "Set your')

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid JSON/i)
    expect(onApply).not.toHaveBeenCalled()
  })

  // Checking is not applying. The reviewer is the last thing standing between
  // an assistant's answer and the catalogue, and they cannot be that if the
  // write happens as a side effect of looking.
  it("shows what would change and writes nothing until it is confirmed", async () => {
    const { user, onApply } = open()

    await paste(user, JSON.stringify(CORRECTED))

    const diff = await screen.findByRole("list", { name: /what would change/i })
    expect(diff).toHaveTextContent("Set your hands hip-width apart.")
    expect(diff).toHaveTextContent("Set your hands shoulder-width apart.")
    expect(onApply).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /approve this correction/i }))

    expect(onApply).toHaveBeenCalledWith(CORRECTED)
  })

  // Well-formed JSON that would still poison the row: the resolver needs every
  // section the French fills to be filled in English, and it fails silently, so
  // this is the one refusal the reviewer could never diagnose on their own. The
  // message names the section rather than saying "invalid".
  it("names the section a correction would empty, and offers no way to apply it", async () => {
    const { user, onApply } = open()

    await paste(
      user,
      JSON.stringify({ ...SUBJECT.instructions_en, breathing: [] }),
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(/Breathing/)
    expect(
      screen.queryByRole("button", { name: /approve this correction/i }),
    ).toBeNull()
    expect(onApply).not.toHaveBeenCalled()
  })

  it("says so in French too", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ReviewAssistDialog
        subject={SUBJECT}
        open
        onOpenChange={vi.fn()}
        onApply={vi.fn()}
        disabled={false}
      />,
      { locale: "fr" },
    )

    await user.click(screen.getByRole("textbox", { name: /json corrigé/i }))
    await user.paste("pas du JSON")
    await user.click(screen.getByRole("button", { name: /vérifier la correction/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/JSON valide/i)
  })
})
