import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as Sentry from "@sentry/react"
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

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
}))

// T123: capture analytics events without going through supabase.from()
// (the production hook short-circuits when authAtom is null, which is the
// default in tests; mocking the hook lets us assert the event payload
// regardless of auth wiring).
const trackEventMock = vi.fn()
vi.mock("@/hooks/useTrackEvent", () => ({
  useTrackEvent: () => ({ mutate: trackEventMock }),
}))

const invokeMock = supabase.functions.invoke as unknown as Mock
const captureExceptionMock = Sentry.captureException as unknown as Mock

const realOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine")

beforeEach(() => {
  invokeMock.mockReset()
  captureExceptionMock.mockReset()
  trackEventMock.mockReset()
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true })
})

afterEach(() => {
  if (realOnLine) Object.defineProperty(navigator, "onLine", realOnLine)
})

describe("EmbeddedAgentChatStep", () => {
  // ---------- T121: Privacy disclosure card ----------

  it("renders an inline privacy disclosure card linking to /privacy on every onboarding session (T121)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "discl001-0000-0000-0000-000000000000",
        status: "open",
        resumed: false,
        messages: [],
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
    await screen.findByText(/Thread discl001/)

    // The card surfaces both the retention claim AND the verbatim warning.
    // Without these the disclosure is incomplete and the GA flag must stay off.
    expect(screen.getByText(/90 days/i)).toBeInTheDocument()
    expect(screen.getByText(/avoid sharing/i)).toBeInTheDocument()

    const link = screen.getByRole("link", { name: /privacy policy/i })
    expect(link).toHaveAttribute("href", "/privacy")
  })

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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)

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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)

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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)

    await screen.findByText(/Thread fresh/)
    expect(screen.queryByText(/Resumed conversation/i)).not.toBeInTheDocument()
  })

  it("renders the offline banner instead of waiting forever when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true })

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)

    expect(screen.getByText(/You're offline/i)).toBeInTheDocument()
  })

  // PR review #7: previously a /thread error (auth/RLS/5xx) was conflated
  // with a true offline event and shown as "You're offline". That blocked
  // recovery (the user kept refreshing instead of re-authenticating) and
  // hid real backend failures from Sentry. We now render a dedicated
  // "couldn't load conversation" banner with an explicit Retry, and
  // capture the error to Sentry so we don't lose visibility.
  it("renders a thread-error banner (not offline) when /thread fails while online", async () => {
    invokeMock.mockRejectedValueOnce(new Error("Edge function returned 500"))

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)

    expect(
      await screen.findByText(/couldn't load your conversation/i),
    ).toBeInTheDocument()
    // Surface a retry CTA so the user can recover without a full reload.
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument()
    // The misleading "You're offline" copy must not appear when we still
    // have network — the failure is server-side.
    expect(screen.queryByText(/You're offline/i)).not.toBeInTheDocument()
  })

  it("captures /thread fetch errors to Sentry with the right tags (not the offline path)", async () => {
    invokeMock.mockRejectedValueOnce(new Error("Edge function returned 500"))

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)

    await screen.findByText(/couldn't load your conversation/i)
    await waitFor(() => {
      expect(captureExceptionMock).toHaveBeenCalled()
    })
    const lastCall = captureExceptionMock.mock.calls[captureExceptionMock.mock.calls.length - 1]
    expect(lastCall[1]).toEqual(
      expect.objectContaining({
        tags: expect.objectContaining({
          feature: "embedded-agent",
          route: "/thread",
        }),
      }),
    )
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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)

    expect(await screen.findByText(/Thread old1/)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /restart/i }))

    await user.click(await screen.findByRole("button", { name: /start over/i }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
        body: { action: "abandon", purpose: "onboarding" },
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
    renderWithProviders(
      <EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={onBack}
      />,
    )

    await screen.findByText(/Thread th-1234/)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /^back$/i }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
        body: { action: "abandon", purpose: "onboarding" },
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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
    await screen.findByText(/Thread chat0001/)

    const user = userEvent.setup()
    const input = screen.getByPlaceholderText(/write a message/i)
    await user.type(input, "My back hurts when I squat.")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    expect(await screen.findByText("My back hurts when I squat.")).toBeInTheDocument()
    expect(await screen.findByText(/Tell me more about your back/i)).toBeInTheDocument()

    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
      body: {
        action: "send",
        purpose: "onboarding",
        content: "My back hurts when I squat.",
        locale: "en",
      },
    })
  })

  // T123: success-only analytics. Counting attempts would double-bill the
  // funnel — server-side `ai_generation_log` already records every turn
  // (success and failure) for quota purposes.
  it("fires embedded_agent_message_sent ONLY on successful turns, with thread_id and ready_for_draft flag", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "anal0001-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          assistant: { content: "Got it.", ts: "2026-05-08T12:00:00Z" },
          ready_for_draft: true,
        },
        error: null,
      })

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
    await screen.findByText(/Thread anal0001/)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/write a message/i), "ready")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith({
        eventType: "embedded_agent_message_sent",
        payload: {
          thread_id: "anal0001-0000-0000-0000-000000000000",
          ready_for_draft: true,
          // T136 (#343) — `purpose` joined the payload so the funnel can
          // split onboarding vs additional_program without joining on
          // thread_id.
          purpose: "onboarding",
        },
      })
    })
  })

  // T136 (#343) — additional-program /send may surface
  // `validator_rejection` when the model emits a ready signal with
  // missing/invalid motivation or out-of-bounds overrides. The chat
  // surface fires a dedicated event so we can monitor the
  // motivation-classification pain points without grepping logs.
  it("fires embedded_agent_motivation_classification_failed when /send response carries validator_rejection (additional_program)", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: {
          thread_id: "valrej01-0000-0000-0000-000000000000",
          status: "open",
          resumed: false,
          messages: [],
          bundle_summary: { sessions_per_week: 3, active_program_name: "PPL" },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          assistant: { content: "Could you tell me why you want a new program?", ts: "2026-05-12T12:00:00Z" },
          ready_for_draft: false,
          validator_rejection: { reason: "invalid_override", field: "daysPerWeek" },
        },
        error: null,
      })

    renderWithProviders(<EmbeddedAgentChatStep
      locale="en"
      purpose="additional_program"
      i18nNamespace="create-program"
      onBack={() => {}}
    />)
    await screen.findByText(/Thread valrej01/)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/write a message/i), "I want 14 days/wk")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith({
        eventType: "embedded_agent_motivation_classification_failed",
        payload: {
          thread_id: "valrej01-0000-0000-0000-000000000000",
          purpose: "additional_program",
          rejection_reason: "invalid_override",
          field: "daysPerWeek",
          locale: "en",
        },
      })
    })
  })

  // T136 (#343) — the additional-program flow surfaces an inline chip so
  // the user knows the assistant is iterating on their existing program.
  // Onboarding threads never receive `bundle_summary` (server contract),
  // so the chip stays hidden there.
  it("renders the bundle summary chip with active program when purpose='additional_program' and bundle_summary is present", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "chip0001-0000-0000-0000-000000000000",
        status: "open",
        resumed: false,
        messages: [],
        bundle_summary: { sessions_per_week: 4, active_program_name: "Hypertrophy 4-day", top_muscle_group: "back" },
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep
      locale="en"
      purpose="additional_program"
      i18nNamespace="create-program"
      onBack={() => {}}
    />)
    await screen.findByText(/Thread chip0001/)

    expect(
      await screen.findByText(/Building on top of Hypertrophy 4-day · 4 sessions\/wk/i),
    ).toBeInTheDocument()
  })

  it("renders the bundle summary 'no active program' variant when bundle_summary lacks active_program_name", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "chip0002-0000-0000-0000-000000000000",
        status: "open",
        resumed: false,
        messages: [],
        bundle_summary: { sessions_per_week: 2 },
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep
      locale="en"
      purpose="additional_program"
      i18nNamespace="create-program"
      onBack={() => {}}
    />)
    await screen.findByText(/Thread chip0002/)

    expect(
      await screen.findByText(/No active program · 2 sessions\/wk recently/i),
    ).toBeInTheDocument()
  })

  it("does NOT render the bundle summary chip for onboarding threads (regression — server omits bundle_summary)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "chip0003-0000-0000-0000-000000000000",
        status: "open",
        resumed: false,
        messages: [],
      },
      error: null,
    })

    renderWithProviders(<EmbeddedAgentChatStep
      locale="en"
      purpose="onboarding"
      i18nNamespace="onboarding"
      onBack={() => {}}
    />)
    await screen.findByText(/Thread chip0003/)

    expect(screen.queryByText(/Building on top of/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No active program/i)).not.toBeInTheDocument()
  })

  it("does NOT fire embedded_agent_message_sent when /message fails (server-side log_everything already counts the attempt)", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "anal0002-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: Object.assign(new Error("502"), {
          context: new Response(
            JSON.stringify({ error: "model_failure" }),
            { status: 502 },
          ),
        }),
      })

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
    await screen.findByText(/Thread anal0002/)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/write a message/i), "boom")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    // Wait until the error UI surfaces so we know the failure path resolved.
    await screen.findByText(/something went wrong/i)
    expect(
      trackEventMock.mock.calls.some(
        ([call]) => call?.eventType === "embedded_agent_message_sent",
      ),
    ).toBe(false)
  })

  // #318 — the incident scenario: a transient Gemini 503 ("high demand")
  // must surface the soft "give it a second, resend" banner, NOT the
  // dead-end "something went wrong" — otherwise a new user bounces
  // mid-onboarding (exactly what happened to the abandoned signup).
  it("renders the soft busy banner (not the fatal one) when /message fails with failure_kind=provider_unavailable", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "busy0001-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: Object.assign(new Error("502"), {
          context: new Response(
            JSON.stringify({
              error: "model_failure",
              failure_kind: "provider_unavailable",
              upstream_status: 503,
            }),
            { status: 502 },
          ),
        }),
      })

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
    await screen.findByText(/Thread busy0001/)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/write a message/i), "boom")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    // Soft banner is shown…
    await screen.findByText(/in high demand/i)
    // …and the generic dead-end banner is NOT.
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
  })

  // #318 — guard the other half: an UNclassified model_failure (legacy 502
  // with no failure_kind, e.g. an older server build) keeps the hard
  // banner. Without this the transient/fatal split could silently swallow
  // every model_failure into the soft path.
  it("keeps the fatal banner (not the busy one) for a model_failure with no failure_kind", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "busy0002-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: Object.assign(new Error("502"), {
          context: new Response(
            JSON.stringify({ error: "model_failure" }),
            { status: 502 },
          ),
        }),
      })

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
    await screen.findByText(/Thread busy0002/)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/write a message/i), "boom")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    await screen.findByText(/something went wrong/i)
    expect(screen.queryByText(/in high demand/i)).not.toBeInTheDocument()
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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)

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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
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
        body: {
          action: "send",
          purpose: "onboarding",
          content: "line one\nline two",
          locale: "en",
        },
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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
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
        purpose="onboarding"
        i18nNamespace="onboarding"
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
        purpose="onboarding"
        i18nNamespace="onboarding"
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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
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
        purpose="onboarding"
        i18nNamespace="onboarding"
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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
    await screen.findByText(/Thread chat0003/)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/write a message/i), "hi")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()

    // T122: fatal /message errors are captured in Sentry with the
    // canonical route + error_kind tags so the dashboard can pair them
    // with server-side `provider_failure` logs.
    await waitFor(() => expect(captureExceptionMock).toHaveBeenCalledTimes(1))
    const callArgs = captureExceptionMock.mock.calls[0]
    expect(callArgs[1]?.tags).toMatchObject({
      feature: "embedded-agent",
      route: "/message",
      error_kind: "model_failure",
    })
  })

  it("does NOT capture turn-quota errors in Sentry — friendly UX, not fatal (T122)", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "chat0004-0000-0000-0000-000000000000", status: "open", resumed: false, messages: [] },
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

    renderWithProviders(<EmbeddedAgentChatStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onBack={() => {}}
      />)
    await screen.findByText(/Thread chat0004/)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/write a message/i), "hi")
    await user.click(screen.getByRole("button", { name: /^send$/i }))

    // Wait for the quota banner to confirm the error path was hit
    // (i18n key is `embeddedAgent.quotaTitle` → "Slow down a moment"),
    // then assert Sentry stayed quiet.
    await screen.findByText(/slow down a moment/i)
    expect(captureExceptionMock).not.toHaveBeenCalled()
  })
})
