import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as Sentry from "@sentry/react"
import { renderWithProviders } from "@/test/utils"
import { supabase } from "@/lib/supabase"
import { EmbeddedAgentGeneratingStep } from "./EmbeddedAgentGeneratingStep"

vi.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
}))

// T123: capture analytics events directly (see EmbeddedAgentChatStep.test.tsx).
const trackEventMock = vi.fn()
vi.mock("@/hooks/useTrackEvent", () => ({
  useTrackEvent: () => ({ mutate: trackEventMock }),
}))

const invokeMock = supabase.functions.invoke as unknown as Mock
const captureExceptionMock = Sentry.captureException as unknown as Mock

beforeEach(() => {
  invokeMock.mockReset()
  captureExceptionMock.mockReset()
  trackEventMock.mockReset()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("EmbeddedAgentGeneratingStep", () => {
  it("fires /draft with trigger:user_cta on mount and calls onSuccess after the mutation resolves", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { status: "preview_ready", trigger: "user_cta" },
      error: null,
    })

    const onSuccess = vi.fn()
    renderWithProviders(
      <EmbeddedAgentGeneratingStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onSuccess={onSuccess}
        onFallbackTemplate={() => {}}
        onFallbackBlank={() => {}}
      />,
    )

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
      body: { action: "draft", purpose: "onboarding", trigger: "user_cta", locale: "en" },
    })
  })

  // T123 analytics: emit `embedded_agent_draft_triggered` on intent (before
  // the network call) so the funnel records the user choice even when
  // /draft fails. `attempt: 0` on the first try, then increments on retry.
  it("fires embedded_agent_draft_triggered { trigger: 'user_cta', attempt: 0 } on mount", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { status: "preview_ready", trigger: "user_cta" },
      error: null,
    })

    renderWithProviders(
      <EmbeddedAgentGeneratingStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onSuccess={() => {}}
        onFallbackTemplate={() => {}}
        onFallbackBlank={() => {}}
      />,
    )

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith({
        eventType: "embedded_agent_draft_triggered",
        // T136 (#343) — `purpose` joined the payload so the funnel can
        // split draft triggers by flow.
        payload: { trigger: "user_cta", attempt: 0, purpose: "onboarding" },
      })
    })
  })

  it("renders an animated loading state (sparkles + phase message + dots) while the mutation is in flight", () => {
    // Pending forever so we can assert the loading UI without onSuccess racing.
    invokeMock.mockReturnValueOnce(new Promise(() => {}))

    const { container } = renderWithProviders(
      <EmbeddedAgentGeneratingStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onSuccess={() => {}}
        onFallbackTemplate={() => {}}
        onFallbackBlank={() => {}}
      />,
    )

    // The first phase message should be visible (we don't pin which one —
    // any non-empty phase string proves the cycler is rendering).
    const liveRegion = container.querySelector('[role="status"]')
    expect(liveRegion).not.toBeNull()
    expect(liveRegion?.textContent?.length).toBeGreaterThan(0)
    // Animated bouncing dots present (3 of them, each a span).
    const dots = container.querySelectorAll(".animate-bounce")
    expect(dots.length).toBe(3)
  })

  it("on a 429 draft_quota_exceeded shows the friendly cap card with template + blank fallbacks (no retry — quota won't unblock)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: Object.assign(new Error("429"), {
        context: new Response(
          JSON.stringify({ error: "draft_quota_exceeded", limit: 3, used: 3 }),
          { status: 429 },
        ),
      }),
    })

    const onTemplate = vi.fn()
    const onBlank = vi.fn()
    renderWithProviders(
      <EmbeddedAgentGeneratingStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onSuccess={() => {}}
        onFallbackTemplate={onTemplate}
        onFallbackBlank={onBlank}
      />,
    )

    expect(await screen.findByText(/daily draft limit reached/i)).toBeInTheDocument()
    // No retry on a quota error — clicking it again would just hit the same wall.
    expect(screen.queryByRole("button", { name: /^retry$/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /pick a template/i }))
    expect(onTemplate).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole("button", { name: /start from scratch/i }))
    expect(onBlank).toHaveBeenCalledTimes(1)
  })

  it("on a 5xx model failure shows a generic error with a working retry that re-fires /draft", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: null,
        error: Object.assign(new Error("502"), {
          context: new Response(JSON.stringify({ error: "draft_failed" }), { status: 502 }),
        }),
      })
      .mockResolvedValueOnce({
        data: { status: "preview_ready", trigger: "user_cta" },
        error: null,
      })

    const onSuccess = vi.fn()
    renderWithProviders(
      <EmbeddedAgentGeneratingStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onSuccess={onSuccess}
        onFallbackTemplate={() => {}}
        onFallbackBlank={() => {}}
      />,
    )

    // Title + body both render. Wait for the retry button as the readiness signal.
    const retryBtn = await screen.findByRole("button", { name: /^retry$/i })
    expect(retryBtn).toBeInTheDocument()

    // T122: fatal /draft error is captured in Sentry tagged with the
    // canonical route so the dashboard can pair it with server-side
    // `provider_failure` logs.
    await waitFor(() => expect(captureExceptionMock).toHaveBeenCalledTimes(1))
    const callArgs = captureExceptionMock.mock.calls[0]
    expect(callArgs[1]?.tags).toMatchObject({
      feature: "embedded-agent",
      route: "/draft",
      error_kind: "model_failure",
    })

    await userEvent.click(retryBtn)
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(invokeMock).toHaveBeenCalledTimes(2)
  })

  it("does NOT capture draft-quota errors in Sentry — friendly UX, not fatal (T122)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: Object.assign(new Error("429"), {
        context: new Response(
          JSON.stringify({ error: "draft_quota_exceeded", limit: 3, used: 3 }),
          { status: 429 },
        ),
      }),
    })

    renderWithProviders(
      <EmbeddedAgentGeneratingStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onSuccess={() => {}}
        onFallbackTemplate={() => {}}
        onFallbackBlank={() => {}}
      />,
    )

    // Wait for the cap card to confirm the error path was hit, then
    // assert Sentry stayed quiet.
    await screen.findByText(/daily draft limit reached/i)
    expect(captureExceptionMock).not.toHaveBeenCalled()
  })

  it("does NOT re-fire /draft when the component re-renders (StrictMode-safe — single inflight call per mount)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { status: "preview_ready", trigger: "user_cta" },
      error: null,
    })

    const { rerender } = renderWithProviders(
      <EmbeddedAgentGeneratingStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onSuccess={() => {}}
        onFallbackTemplate={() => {}}
        onFallbackBlank={() => {}}
      />,
    )

    // Force a re-render by passing the same props again.
    rerender(
      <EmbeddedAgentGeneratingStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onSuccess={() => {}}
        onFallbackTemplate={() => {}}
        onFallbackBlank={() => {}}
      />,
    )

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1))
  })
})
