import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/utils"
import { supabase } from "@/lib/supabase"
import { EmbeddedAgentChatStep } from "./EmbeddedAgentChatStep"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

const invokeMock = supabase.functions.invoke as unknown as Mock

const realOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine")

beforeEach(() => {
  invokeMock.mockReset()
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true })
})

afterEach(() => {
  if (realOnLine) Object.defineProperty(navigator, "onLine", realOnLine)
})

describe("EmbeddedAgentChatStep", () => {
  it("renders the thread shortened id, status and a Restart action once /thread resolves", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "deadbeef-1234-5678-9abc-deadbeefcafe",
        status: "open",
        resumed: false,
        messages: [],
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    expect(
      await screen.findByText(/Thread deadbeef · open/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /Build your program with the assistant/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /restart/i }),
    ).toBeInTheDocument()
  })

  it("shows the resumed badge when the thread was resumed", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "abcdef12-0000-0000-0000-000000000000",
        status: "preview_ready",
        resumed: true,
        messages: [],
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    expect(await screen.findByText(/Resumed conversation/i)).toBeInTheDocument()
  })

  it("does not show the resumed badge for a fresh thread", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "fresh1234-0000-0000-0000-000000000000",
        status: "open",
        resumed: false,
        messages: [],
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    await screen.findByText(/Thread fresh/)
    expect(screen.queryByText(/Resumed conversation/i)).not.toBeInTheDocument()
  })

  it("renders the offline banner instead of waiting forever when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    expect(screen.getByText(/You're offline/i)).toBeInTheDocument()
  })

  it("renders the offline banner when /thread fails to fetch", async () => {
    invokeMock.mockRejectedValueOnce(new Error("network"))

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    expect(await screen.findByText(/You're offline/i)).toBeInTheDocument()
  })

  it("Restart confirms, abandons the active thread, and refetches a fresh one", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "old11111-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: { thread_id: "new22222-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    expect(await screen.findByText(/Thread old1/)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /restart/i }))

    await user.click(await screen.findByRole("button", { name: /start over/i }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
        body: { action: "abandon" },
      })
    })

    expect(await screen.findByText(/Thread new2/)).toBeInTheDocument()
  })

  it("Back abandons the active thread and calls onBack", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "th-1234-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })

    const onBack = vi.fn()
    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={onBack} />)

    await screen.findByText(/Thread th-1234/)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /^back$/i }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
        body: { action: "abandon" },
      })
    })
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  // ---------- T118: chat surface ----------

  it("submits the input and renders both user and assistant bubbles", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "chat0001-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          assistant: { content: "Tell me more about your back.", ts: "2026-05-08T12:00:00Z" },
          ready_for_draft: false,
        },
        error: null,
      })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)
    await screen.findByText(/Thread chat0001/)

    const user = userEvent.setup()
    const input = screen.getByPlaceholderText(/write a message/i)
    await user.type(input, "My back hurts when I squat.")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    expect(await screen.findByText("My back hurts when I squat.")).toBeInTheDocument()
    expect(await screen.findByText(/Tell me more about your back/i)).toBeInTheDocument()

    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
      body: { action: "send", content: "My back hurts when I squat.", locale: "en" },
    })
  })

  it("renders the friendly cap card on a 429 quota response", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "chat0002-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: Object.assign(new Error("429"), {
          context: new Response(
            JSON.stringify({ error: "turn_quota_exceeded", limit: 40, used: 40 }),
            { status: 429 },
          ),
        }),
      })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)
    await screen.findByText(/Thread chat0002/)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/write a message/i), "hi")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    expect(await screen.findByText(/Slow down a moment/i)).toBeInTheDocument()
    expect(screen.queryByText(/turn_quota_exceeded/i)).not.toBeInTheDocument()
  })

  // ---------- UX polish: optimistic user bubble + typing indicator ----------

  it("renders the user bubble and typing indicator immediately, before the assistant reply arrives", async () => {
    let resolveSend: (value: { data: unknown; error: null }) => void = () => {}
    const pending = new Promise<{ data: unknown; error: null }>((resolve) => {
      resolveSend = resolve
    })

    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "opt00001-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockReturnValueOnce(pending)

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)
    await screen.findByText(/Thread opt00001/)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/write a message/i), "Quick question.")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    expect(await screen.findByText("Quick question.")).toBeInTheDocument()
    expect(screen.getByText(/typing|écrit/i)).toBeInTheDocument()
    expect(screen.queryByText(/Here is my reply/i)).not.toBeInTheDocument()

    resolveSend({
      data: {
        assistant: { content: "Here is my reply.", ts: "2026-05-08T12:00:00Z" },
        ready_for_draft: false,
      },
      error: null,
    })

    expect(await screen.findByText("Here is my reply.")).toBeInTheDocument()
    expect(screen.queryByText(/typing|écrit/i)).not.toBeInTheDocument()
  })

  // ---------- UI polish: markdown rendering + Enter-to-send ----------

  it("renders **bold** in assistant replies as a real <strong> element", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "md000001-0000-0000-0000-000000000000",
        status: "open",
        resumed: false,
        messages: [
          { role: "assistant", content: "Try **deadlifts** twice a week.", ts: "2026-05-08T12:00:00Z" },
        ],
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)

    const bold = await screen.findByText("deadlifts")
    expect(bold.tagName).toBe("STRONG")
  })

  it("submits on Enter and inserts a newline on Shift+Enter", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "kbd00001-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          assistant: { content: "Got it.", ts: "2026-05-08T12:00:00Z" },
          ready_for_draft: false,
        },
        error: null,
      })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)
    await screen.findByText(/Thread kbd00001/)

    const user = userEvent.setup()
    const textarea = screen.getByPlaceholderText(/write a message/i) as HTMLTextAreaElement
    await user.click(textarea)

    await user.keyboard("line one{Shift>}{Enter}{/Shift}line two")
    expect(textarea.value).toBe("line one\nline two")
    expect(invokeMock).toHaveBeenCalledTimes(1) // /thread open only

    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
        body: { action: "send", content: "line one\nline two", locale: "en" },
      })
    })
  })

  // ---------- T119: Generate my plan CTA ----------

  function makeMessages(turns: number) {
    // Builds a transcript with `turns` assistant messages (and one user
    // message before each) so the CTA visibility logic — which keys off
    // the assistant turn count — can be exercised deterministically.
    return Array.from({ length: turns }).flatMap((_, i) => [
      { role: "user" as const, content: `user ${i}`, ts: `2026-05-08T12:00:0${i}Z` },
      { role: "assistant" as const, content: `assistant ${i}`, ts: `2026-05-08T12:00:0${i}Z` },
    ])
  }

  it("hides the Generate my plan CTA on the very first assistant turn (premature)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "cta00001-0000-0000-0000-000000000000",
        status: "open",
        resumed: true,
        messages: makeMessages(1),
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)
    await screen.findByText(/Thread cta00001/)

    expect(screen.queryByRole("button", { name: /generate my plan/i })).not.toBeInTheDocument()
  })

  it("shows the Generate my plan CTA once the assistant has answered 2 turns", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "cta00002-0000-0000-0000-000000000000",
        status: "open",
        resumed: true,
        messages: makeMessages(2),
      },
      error: null,
    })

    renderWithProviders(
      <EmbeddedAgentChatStep
        locale="en"
        onBack={() => {}}
        onGenerateRequest={() => {}}
      />,
    )
    await screen.findByText(/Thread cta00002/)

    expect(screen.getByRole("button", { name: /generate my plan/i })).toBeInTheDocument()
  })

  it("clicking the CTA delegates to onGenerateRequest (no inline /draft call — the next wizard step owns the mutation)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "cta00003-0000-0000-0000-000000000000",
        status: "open",
        resumed: true,
        messages: makeMessages(2),
      },
      error: null,
    })

    const onGenerateRequest = vi.fn()
    renderWithProviders(
      <EmbeddedAgentChatStep
        locale="en"
        onBack={() => {}}
        onGenerateRequest={onGenerateRequest}
      />,
    )
    await screen.findByText(/Thread cta00003/)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /generate my plan/i }))

    expect(onGenerateRequest).toHaveBeenCalledTimes(1)
    // Critical: the chat step itself must NOT fire /draft — only /thread
    // (the initial open). Anything else means the loading-state refactor
    // regressed and we're back to the disabled-button-only UX.
    expect(invokeMock).toHaveBeenCalledTimes(1)
  })

  it("hides the Generate my plan CTA when no onGenerateRequest handler is wired (defensive — would be a no-op click)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "cta00005-0000-0000-0000-000000000000",
        status: "open",
        resumed: true,
        messages: makeMessages(2),
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)
    await screen.findByText(/Thread cta00005/)

    expect(screen.queryByRole("button", { name: /generate my plan/i })).not.toBeInTheDocument()
  })

  // ---------- T120 fix: resumed preview_ready threads shouldn't 409 on Generate ----------

  it("hides the Generate my plan CTA when the resumed thread is already in preview_ready (would 409 on /draft)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "resume01-0000-0000-0000-000000000000",
        status: "preview_ready",
        resumed: true,
        messages: makeMessages(3),
        last_preview: { args: { name: "Existing draft", days: [] } },
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)
    await screen.findByText(/Thread resume01/)

    expect(
      screen.queryByRole("button", { name: /generate my plan/i }),
    ).not.toBeInTheDocument()
  })

  it("shows a View your draft CTA when the thread is preview_ready, and clicking it calls onPreviewReady without a server call", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "resume02-0000-0000-0000-000000000000",
        status: "preview_ready",
        resumed: true,
        messages: makeMessages(3),
        last_preview: { args: { name: "Existing draft", days: [] } },
      },
      error: null,
    })

    const onPreviewReady = vi.fn()
    renderWithProviders(
      <EmbeddedAgentChatStep
        locale="en"
        onBack={() => {}}
        onPreviewReady={onPreviewReady}
      />,
    )
    await screen.findByText(/Thread resume02/)

    const viewBtn = await screen.findByRole("button", { name: /view your draft/i })
    await userEvent.click(viewBtn)

    expect(onPreviewReady).toHaveBeenCalledTimes(1)
    // Pure navigation — no extra MCP/edge call beyond the initial /thread fetch.
    expect(invokeMock).toHaveBeenCalledTimes(1)
  })

  it("renders an error card with retry on a 5xx model failure", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "chat0003-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: Object.assign(new Error("502"), {
          context: new Response(JSON.stringify({ error: "model_failure" }), { status: 502 }),
        }),
      })

    renderWithProviders(<EmbeddedAgentChatStep locale="en" onBack={() => {}} />)
    await screen.findByText(/Thread chat0003/)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/write a message/i), "hi")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })
})
