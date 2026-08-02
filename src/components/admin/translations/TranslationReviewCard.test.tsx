import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { TranslationReviewCard } from "@/components/admin/translations/TranslationReviewCard"
import type { TranslationReviewRow } from "@/hooks/useTranslationReviewQueue"

type Payload = Record<string, unknown>

type Response = { data: { id: string }[] | null; error: Error | null }

const select = vi.fn<(columns: string) => Promise<Response>>()
const eq = vi.fn<(column: string, id: string) => { select: typeof select }>(
  () => ({ select }),
)
const update = vi.fn<(payload: Payload) => { eq: typeof eq }>(() => ({ eq }))
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({ update: (payload: Payload) => update(payload) }) },
}))

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

const lastPayload = (): Payload => update.mock.calls.at(-1)?.[0] ?? {}

// jsdom exposes no clipboard, so every test that copies has to say what the
// browser is offering — and restore it, or the stub decides the outcome of
// whichever file runs next in the same worker.
const originalClipboard = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  "clipboard",
)

const stubClipboard = (value: unknown) =>
  Object.defineProperty(navigator, "clipboard", { value, configurable: true })

beforeEach(() => {
  vi.clearAllMocks()
  select.mockResolvedValue({ data: [{ id: "row-1" }], error: null })
})

const originalExecCommand = Object.getOwnPropertyDescriptor(
  Document.prototype,
  "execCommand",
)

const restore = (
  target: object,
  property: string,
  descriptor: PropertyDescriptor | undefined,
) => {
  delete (target as Record<string, unknown>)[property]
  if (descriptor) Object.defineProperty(target, property, descriptor)
}

afterEach(() => {
  restore(navigator, "clipboard", originalClipboard)
  restore(document, "execCommand", originalExecCommand)
})

const row: TranslationReviewRow = {
  id: "row-1",
  name: "Développé couché",
  name_en: "Bench Press",
  instructions: {
    setup: [
      "Allongez-vous sur le banc.",
      "Écartez les mains à largeur d'épaules.",
    ],
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
  instructions_en_status: "flagged",
  instructions_en_audit: {
    model: "gemini-2.5-flash",
    prompt_version: 1,
    translated_at: "2026-08-02T12:26:44.264Z",
    checker_model: "llama-3.3-70b-versatile",
    gate_flags: ["calques: lumbar"],
    objections: [
      {
        section: "setup",
        index: 1,
        verdict: "measurement-changed",
        note: "'largeur des épaules' rendered as 'hip-width'",
      },
    ],
  },
  logged_sets: 152,
}

const lineContaining = (text: string): HTMLElement =>
  screen.getByText(text).closest("li")!

/** The corrected block an arbiter hands back: one sentence rewritten. */
const CORRECTED = {
  setup: ["Lie back on the bench.", "Set your hands shoulder-width apart."],
  movement: ["Press the bar upward."],
  breathing: ["Exhale as you press."],
  common_mistakes: ["Arched lower back."],
}

/** The whole round trip, from opening the dialog to confirming the diff. */
const adjudicate = async (
  user: ReturnType<typeof userEvent.setup>,
  block: unknown,
) => {
  await user.click(screen.getByRole("button", { name: /review assist/i }))
  await user.click(screen.getByRole("textbox", { name: /corrected json/i }))
  await user.paste(JSON.stringify(block))
  await user.click(screen.getByRole("button", { name: /check the correction/i }))
  await user.click(screen.getByRole("button", { name: /approve this correction/i }))
}

describe("TranslationReviewCard", () => {
  it("shows both names, the status and the reading exposure", () => {
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    expect(screen.getByText("Développé couché")).toBeInTheDocument()
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.getByText("Flagged")).toBeInTheDocument()
    expect(screen.getByText("152 logged sets")).toBeInTheDocument()
  })

  // The acceptance criterion: the objection is attached to the sentence it
  // named. Asserting it lands *somewhere* would pass on a section-level banner,
  // so both the presence and the absence are checked.
  it("renders an objection on the sentence it targeted", () => {
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    const targeted = lineContaining("Set your hands hip-width apart.")
    expect(
      within(targeted).getByText(/measurement-changed/),
    ).toBeInTheDocument()
    expect(
      within(targeted).getByText(
        "'largeur des épaules' rendered as 'hip-width'",
        { exact: false },
      ),
    ).toBeInTheDocument()
  })

  it("leaves the untargeted sentence in the same section clean", () => {
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    const untouched = lineContaining("Lie back on the bench.")
    expect(within(untouched).queryByText(/measurement-changed/)).toBeNull()
  })

  it("pairs each English sentence with its French counterpart", () => {
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    const pair = lineContaining("Set your hands hip-width apart.")
    expect(
      within(pair).getByText("Écartez les mains à largeur d'épaules."),
    ).toBeInTheDocument()
  })

  // A gate flag has no section or index, so it belongs to the row, not to a
  // sentence — and a row can be flagged with no objection at all.
  it("shows gate flags at row level and survives an empty objection list", () => {
    const gateOnly: TranslationReviewRow = {
      ...row,
      instructions_en_audit: { ...row.instructions_en_audit!, objections: [] },
    }
    renderWithProviders(<TranslationReviewCard row={gateOnly} onSkip={vi.fn()} />)

    expect(screen.getByText("calques: lumbar")).toBeInTheDocument()
    expect(screen.queryByText(/measurement-changed/)).toBeNull()
  })

  it("names the missing side when the translation dropped a sentence", () => {
    const truncated: TranslationReviewRow = {
      ...row,
      instructions_en: { ...row.instructions_en!, setup: ["Lie back on the bench."] },
    }
    renderWithProviders(
      <TranslationReviewCard row={truncated} onSkip={vi.fn()} />,
    )

    const orphaned = lineContaining("Écartez les mains à largeur d'épaules.")
    expect(
      within(orphaned).getByText("no sentence at this position"),
    ).toBeInTheDocument()
  })

  it("says so when the cross-checker never answered", () => {
    const unchecked: TranslationReviewRow = {
      ...row,
      instructions_en_audit: { ...row.instructions_en_audit!, checker_model: null },
    }
    renderWithProviders(
      <TranslationReviewCard row={unchecked} onSkip={vi.fn()} />,
    )

    expect(screen.getByText(/no cross-checker/)).toBeInTheDocument()
  })

  it("renders every label in French under the fr locale", () => {
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />, {
      locale: "fr",
    })

    expect(screen.getByText("Signalée")).toBeInTheDocument()
    expect(screen.getByText("Mise en place")).toBeInTheDocument()
    expect(screen.getByText("152 séries loguées")).toBeInTheDocument()
    expect(screen.getAllByText("Anglais").length).toBeGreaterThan(0)
    expect(
      screen.getByRole("button", { name: /rendre au français/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /approuver/i }),
    ).toBeInTheDocument()
  })

  it("names its editing controls in French too", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />, {
      locale: "fr",
    })

    await user.keyboard("e")

    expect(
      screen.getByRole("textbox", { name: /mise en place/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /annuler l'édition/i }),
    ).toBeInTheDocument()
  })
})

describe("TranslationReviewCard decisions", () => {
  it("records an approval for the row it is showing", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: /^approve$/i }))

    await waitFor(() =>
      expect(lastPayload()).toMatchObject({
        instructions_en_status: "approved",
      }),
    )
    expect(eq).toHaveBeenCalledWith("id", "row-1")
  })

  // The card takes focus on mount so the shortcuts work on arrival: a reviewer
  // who has to click the card before pressing A is not going faster than the
  // mouse, which is the entire point of the four keys.
  it("approves on A without anything being clicked first", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("a")

    await waitFor(() =>
      expect(lastPayload()).toMatchObject({
        instructions_en_status: "approved",
      }),
    )
  })

  it("sends the row back to French from the button", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: /revert to french/i }))

    await waitFor(() =>
      expect(lastPayload()).toMatchObject({
        instructions_en_status: "flagged",
      }),
    )
    expect(Object.keys(lastPayload())).not.toContain("instructions_en")
  })

  it("sends the row back to French on R", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("r")

    await waitFor(() =>
      expect(lastPayload()).toMatchObject({
        instructions_en_status: "flagged",
      }),
    )
  })

  // Skipping is the only affordance that must reach the page: a row nobody
  // decided has to stay in the queue for the next pass.
  it("skips on arrow right without recording anything", async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={onSkip} />)

    await user.keyboard("{ArrowRight}")

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(update).not.toHaveBeenCalled()
  })

  // One textarea per section, one sentence per line — deliberately spartan.
  // Structured correction, shape validation and the diff are T160's job.
  it("opens one named textarea per section on E, one sentence per line", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("e")

    expect(screen.getAllByRole("textbox")).toHaveLength(4)
    expect(screen.getByRole("textbox", { name: /setup/i })).toHaveValue(
      "Lie back on the bench.\nSet your hands hip-width apart.",
    )
    expect(screen.getByRole("textbox", { name: /common mistakes/i })).toHaveValue(
      "Arched lower back.",
    )
  })

  it("approves the corrected English, leaving the untouched sections intact", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("e")
    const setupBox = screen.getByRole("textbox", { name: /setup/i })
    await user.clear(setupBox)
    await user.type(
      setupBox,
      "Lie back on the bench.{Enter}Set your hands shoulder-width apart.",
    )
    await user.click(screen.getByRole("button", { name: /^approve/i }))

    await waitFor(() =>
      expect(lastPayload().instructions_en).toEqual({
        setup: [
          "Lie back on the bench.",
          "Set your hands shoulder-width apart.",
        ],
        movement: ["Press the bar upward."],
        breathing: ["Exhale as you press."],
        common_mistakes: ["Arched lower back."],
      }),
    )
    expect(lastPayload()).toMatchObject({ instructions_en_status: "approved" })
  })

  // The acceptance criterion that keeps the shortcuts from eating the edit:
  // "a rack" contains A, R and E, which is every letter shortcut there is.
  it("does not fire a shortcut while the reviewer is typing a correction", async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={onSkip} />)

    await user.keyboard("e")
    await user.type(
      screen.getByRole("textbox", { name: /movement/i }),
      " a rack{ArrowRight}",
    )

    expect(update).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
    expect(screen.getAllByRole("textbox")).toHaveLength(4)
  })

  it("confirms a recorded decision by name", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("a")

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Développé couché"),
      ),
    )
  })

  // The failure path the reviewer must be able to trust: nothing was recorded,
  // so the row has to still be there — and they have to be told.
  it("reports a failed write and keeps the row on screen", async () => {
    select.mockResolvedValue({ data: null, error: new Error("rls denied") })
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("a")

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(
      screen.getByRole("heading", { name: "Développé couché" }),
    ).toBeInTheDocument()
  })

  // Half of Bugbot's high finding: `E` opened the editor but left focus on the
  // card, so the first thing typed went to the shortcut handler.
  it("puts the cursor in the first section when edit mode opens", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("e")

    expect(screen.getAllByRole("textbox")[0]).toHaveFocus()
  })

  // The other half, and the reason focus management alone will not do: a
  // reviewer can click the card background, or the browser can restore focus
  // somewhere unhelpful. With the handler live, typing the word "bar" approves
  // the translation on their behalf — an action attributed to a human who did
  // not take it.
  it("stops handling shortcuts while edit mode is open, wherever focus lands", async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={onSkip} />)

    await user.keyboard("e")
    await user.click(screen.getByRole("article"))
    await user.keyboard("bar{ArrowRight}")

    expect(update).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
    expect(screen.getAllByRole("textbox")).toHaveLength(4)
  })

  // Escape is the only key the handler still answers in edit mode, and it means
  // what the button next to it says: cancel. The draft goes, and the shortcuts
  // come back — which they cannot do unless focus comes back to the card too.
  it("discards the correction and re-arms the shortcuts on Escape", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("e")
    await user.type(screen.getAllByRole("textbox")[0], " Rewritten.")
    await user.keyboard("{Escape}")

    expect(screen.queryAllByRole("textbox")).toHaveLength(0)

    await user.keyboard("a")

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(Object.keys(lastPayload())).not.toContain("instructions_en")
  })

  // The card announces its shortcuts in its accessible name, so silencing them
  // in edit mode without saying so would leave a screen reader reading out keys
  // that no longer do anything.
  it("announces the only shortcut that still works while editing", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("e")

    expect(
      screen.getByRole("article", { name: /escape/i }),
    ).toBeInTheDocument()
  })

  // A refused write and a dropped connection are not the same problem for the
  // reviewer: retrying fixes one and never fixes the other, so the toast has to
  // tell them apart.
  it("names a refused write rather than blaming the connection", async () => {
    select.mockResolvedValue({ data: [], error: null })
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("a")

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("refused"),
      ),
    )
  })

  // A held key repeats, and the queue only rebuilds once the first write lands.
  // Without a guard the second press writes the row a second time, and a third
  // could land on a row the reviewer can no longer see.
  it("ignores a second decision while the first is still in flight", async () => {
    select.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("a")
    await user.keyboard("r")

    expect(update).toHaveBeenCalledTimes(1)
  })

  // `isPending` goes false the moment the write resolves, but the decided row
  // stays on screen until the queue refetch lands. In that window approve and
  // revert are live again and the second verdict wins — one reviewer
  // contradicting themselves inside a single row.
  it("refuses a contradictory second verdict after the first one lands", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("a")
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    await user.keyboard("r")

    expect(update).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: /revert/i })).toBeDisabled()
    // Editing is gated on the same condition rather than left live: a correction
    // that can no longer be submitted is an invitation to waste typing.
    expect(screen.getByRole("button", { name: /edit/i })).toBeDisabled()
    await user.keyboard("e")
    expect(screen.queryAllByRole("textbox")).toHaveLength(0)
  })

  // The row is still in the queue after a refused write, so the card the
  // reviewer is looking at is the one they have to retry from.
  it("lets the reviewer try again after a write the database refused", async () => {
    select.mockResolvedValueOnce({ data: [], error: null })
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("a")
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    await user.keyboard("a")

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
  })

  // Skip never goes through the mutation — it moves the page index locally — so
  // it is not gated by accident like approve and revert were. `a` then `→`
  // before the queue rebuilds advances one row, and the refetch then drops the
  // decided row and shifts everything up by one more: a row nobody ever looked
  // at is gone from the session, which is the worst thing a review queue can do.
  it("refuses to skip once a verdict has been issued", async () => {
    select.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    const onSkip = vi.fn()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={onSkip} />)

    await user.keyboard("a")
    await user.keyboard("{ArrowRight}")

    expect(onSkip).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /skip/i })).toBeDisabled()
  })

  it("puts the adjudication request on the clipboard", async () => {
    const user = userEvent.setup()
    // After `setup()`, which installs a clipboard stub of its own that would
    // otherwise swallow the write.
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard({ writeText })
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: /review assist/i }))
    await user.click(screen.getByRole("button", { name: /copy the request/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const request: string = writeText.mock.calls[0][0]
    expect(request).toContain("Développé couché")
    expect(request).toContain("Set your hands hip-width apart.")
    expect(request).toContain("measurement-changed")
    expect(update).not.toHaveBeenCalled()
  })

  // An insecure context is where this screen is most likely to be used from a
  // phone, and a copy button that does nothing there is a dead end. The text
  // has to end up somewhere the reviewer can still select it.
  it("hands the request over in a toast when the clipboard is unreachable", async () => {
    const user = userEvent.setup()
    stubClipboard(undefined)
    Object.defineProperty(document, "execCommand", {
      value: () => false,
      configurable: true,
    })
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: /review assist/i }))
    await user.click(screen.getByRole("button", { name: /copy the request/i }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    const [message, options] = toastError.mock.calls[0]
    expect(message).toMatch(/clipboard/i)
    expect(options.description).toContain("Set your hands hip-width apart.")
  })

  // The end of the round trip, through the one write path T159 built: the
  // payload has to carry all four sections, because a partial block fails the
  // resolver's parity check and the row would render French while reading
  // `approved`.
  it("writes an approved correction through the same mutation as the buttons", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await adjudicate(user, CORRECTED)

    await waitFor(() => expect(lastPayload().instructions_en).toEqual(CORRECTED))
    expect(lastPayload()).toMatchObject({ instructions_en_status: "approved" })
    expect(update).toHaveBeenCalledTimes(1)
    // Written, so there is nothing left to adjudicate and the diff goes away.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  /**
   * The failure path, which is the only way to reach it and therefore the way
   * it would have reached production.
   *
   * A correction that fails to write used to leave the reviewer in front of a
   * closed dialog with the gate reopened, one keystroke from approving the
   * machine English they had just adjudicated *against* — marked reviewed by a
   * human who reviewed something else. So the write and the diff share a
   * lifetime: nothing is dismissed until something is written, and while the
   * diff is up the card answers no keys at all.
   */
  it("keeps the diff on screen when the write fails, and answers no retry key", async () => {
    select.mockResolvedValue({ data: [], error: null })
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await adjudicate(user, CORRECTED)
    await waitFor(() => expect(toastError).toHaveBeenCalled())

    await user.keyboard("a")

    expect(update).toHaveBeenCalledTimes(1)
    expect(
      within(screen.getByRole("dialog")).getByRole("list", {
        name: /what would change/i,
      }),
    ).toHaveTextContent("Set your hands shoulder-width apart.")
  })

  // And the retry writes the correction, not a bare approval: the reviewer
  // clicks the same button under the same diff, so the second attempt cannot
  // mean something different from the first.
  it("resubmits the adjudicated block when the reviewer retries", async () => {
    select.mockResolvedValueOnce({ data: [], error: null })
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await adjudicate(user, CORRECTED)
    await waitFor(() => expect(toastError).toHaveBeenCalled())

    await user.click(screen.getByRole("button", { name: /approve this correction/i }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    expect(lastPayload().instructions_en).toEqual(CORRECTED)
    expect(lastPayload()).toMatchObject({ instructions_en_status: "approved" })
  })

  /**
   * Two proposals cannot coexist. A reviewer who was midway through a manual
   * edit and then adjudicated has said which one they mean, and the abandoned
   * draft must not be able to win a later approval — a stale draft written
   * under `approved` is the same defect as the machine English, in a costume.
   */
  it("drops a manual draft the correction supersedes", async () => {
    select.mockResolvedValue({ data: [], error: null })
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("e")
    await user.type(
      screen.getByRole("textbox", { name: /edit the english for setup/i }),
      "Draft nobody adjudicated.",
    )
    await adjudicate(user, CORRECTED)
    await waitFor(() => expect(toastError).toHaveBeenCalled())

    // Dismissing the diff abandons the correction with it, so the card is back
    // to proposing nothing — and approving writes the row as it stands.
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    // Clicked rather than typed: the keyboard is already deaf while the editors
    // are open, so the button is the only way the stale draft could reach the
    // column, and therefore the only place worth asserting.
    await user.click(screen.getByRole("button", { name: /^approve/i }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    expect(lastPayload().instructions_en).toBeUndefined()
    expect(screen.queryByRole("textbox", { name: /edit the english/i })).toBeNull()
  })

  // The T159 defect wearing a different hat. Radix portals the dialog out of
  // this card's DOM, but a React portal still propagates events up the React
  // tree, so every keystroke in the dialog reaches the card's handler.
  //
  // The keys are pressed with focus wherever the dialog put it — a button, not
  // a textbox — because that is the hole the existing typing-target check does
  // not cover: `A` on the copy button would approve the row from inside a
  // dialog the reviewer opened to read.
  it("answers no shortcut while the assist dialog is open", async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={onSkip} />)

    await user.click(screen.getByRole("button", { name: /review assist/i }))
    await user.keyboard("ar{ArrowRight}")

    expect(update).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  // And the paste box itself, which is the same claim one layer in: the letters
  // have to land in the text.
  it("keeps a shortcut letter typed into the paste box as text", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: /review assist/i }))
    await user.type(
      screen.getByRole("textbox", { name: /corrected json/i }),
      "a rack",
    )

    expect(update).not.toHaveBeenCalled()
    expect(
      screen.getByRole("textbox", { name: /corrected json/i }),
    ).toHaveValue("a rack")
  })

  // Opening the dialog to read is not a verdict, but a decided row has nothing
  // left to adjudicate: it leaves the queue on the next refetch, and the write
  // behind the dialog is gated anyway. Disabling it is the same argument T159
  // made for the edit button — a correction that can no longer be submitted is
  // an invitation to waste typing.
  it("closes the assist off once a verdict has been issued", async () => {
    select.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await user.keyboard("a")

    expect(screen.getByRole("button", { name: /review assist/i })).toBeDisabled()
  })

  // The refusal handling is inherited rather than reimplemented, and this is
  // what says so: a second write path added later would pass every other test
  // in this file and fail this one.
  it("reports a refused correction as a refusal", async () => {
    select.mockResolvedValue({ data: [], error: null })
    const user = userEvent.setup()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={vi.fn()} />)

    await adjudicate(user, row.instructions_en)

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining("refused")),
    )
    expect(toastSuccess).not.toHaveBeenCalled()
    // Queried by text, not by role: the open modal marks the card `aria-hidden`
    // for everyone outside it, which is correct and is not the claim here — the
    // claim is that the row did not go anywhere.
    expect(screen.getByText("Développé couché")).toBeInTheDocument()
  })

  it("skips from the button too", async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    renderWithProviders(<TranslationReviewCard row={row} onSkip={onSkip} />)

    await user.click(screen.getByRole("button", { name: /skip/i }))

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(update).not.toHaveBeenCalled()
  })
})
