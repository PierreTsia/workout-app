import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as Sentry from "@sentry/react"
import { renderWithProviders } from "@/test/utils"
import { supabase } from "@/lib/supabase"
import { EmbeddedAgentPreviewStep } from "./EmbeddedAgentPreviewStep"

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

// T123: capture analytics events directly (see EmbeddedAgentChatStep.test.tsx).
const trackEventMock = vi.fn()
vi.mock("@/hooks/useTrackEvent", () => ({
  useTrackEvent: () => ({ mutate: trackEventMock }),
}))

const invokeMock = supabase.functions.invoke as unknown as Mock
const captureExceptionMock = Sentry.captureException as unknown as Mock

const PREVIEW_THREAD = {
  thread_id: "thread-pr-1",
  status: "preview_ready" as const,
  resumed: true,
  messages: [],
  last_preview: {
    args: {
      name: "Hypertrophy — 4 days/wk",
      days: [
        { label: "Push", exercises: ["uuid-1", "uuid-2"] },
        { label: "Pull", exercises: ["uuid-3"] },
      ],
    },
    rendered: [
      {
        label: "Push",
        lines: [
          "Bench Press — 4 × 8 × 80 kg total — 120s rest",
          "Overhead Press — 3 × 10 × 40 kg total — 90s rest",
        ],
      },
      {
        label: "Pull",
        lines: ["Barbell Row — 4 × 8 × 70 kg total — 120s rest"],
      },
    ],
  },
}

beforeEach(() => {
  invokeMock.mockReset()
  captureExceptionMock.mockReset()
  trackEventMock.mockReset()
  sessionStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
})

function noop() {}

describe("EmbeddedAgentPreviewStep — happy path rendering", () => {
  it("renders each day as a collapsible card; first day expanded by default with parsed exercise rows", async () => {
    invokeMock.mockResolvedValueOnce({ data: PREVIEW_THREAD, error: null })

    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    expect(
      await screen.findByRole("heading", { name: /Your draft program/i }),
    ).toBeInTheDocument()
    // Day headers always visible.
    expect(screen.getByText("Push")).toBeInTheDocument()
    expect(screen.getByText("Pull")).toBeInTheDocument()
    // Day 1 expanded by default → exercise NAMES split out from their tail.
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.getByText("Overhead Press")).toBeInTheDocument()
    // Tails (sets/reps · rest) are shown alongside, but as separate text nodes.
    expect(screen.getByText(/4 × 8 × 80 kg total · 120s rest/i)).toBeInTheDocument()
    // Day 2 collapsed by default → its exercise names not in the DOM yet.
    expect(screen.queryByText("Barbell Row")).not.toBeInTheDocument()
  })

  it("expanding the second day reveals its exercises and collapses the first", async () => {
    invokeMock.mockResolvedValueOnce({ data: PREVIEW_THREAD, error: null })

    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    // Wait for the initial render.
    await screen.findByText("Bench Press")

    // Click on the Pull day header.
    const pullHeader = screen.getByRole("button", { name: /Pull/i })
    await userEvent.click(pullHeader)

    // Pull's exercise should now be visible.
    expect(await screen.findByText("Barbell Row")).toBeInTheDocument()
    // And Push's exercises should be gone (single-expanded behavior, like
    // the legacy AIProgramPreviewStep).
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument()
  })

  it("strips a 'Day N:' prefix from labels — the model often double-prefixes ('Day 1: Upper Body')", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        ...PREVIEW_THREAD,
        last_preview: {
          ...PREVIEW_THREAD.last_preview,
          rendered: [
            { label: "Day 1: Upper Body — Push Focus", lines: ["Push-up — 3 × 10 — 60s rest"] },
            { label: "Day 2 - Pull", lines: ["Row — 3 × 10 — 60s rest"] },
          ],
        },
      },
      error: null,
    })

    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    // Cleaned labels — no double "Day 1:" / "Day 2 -" prefix.
    expect(await screen.findByText(/^Upper Body — Push Focus$/)).toBeInTheDocument()
    expect(screen.getByText(/^Pull$/)).toBeInTheDocument()
  })

  it("falls back to args-only rendering when last_preview.rendered is a string (legacy persisted shape)", async () => {
    // Pre-T120 threads stored `rendered` as a single string (markdown-ish
    // free text from the model). After we switched the field to RenderedDay[],
    // any thread persisted under the old contract would crash on
    // `rendered.map`. Defensively treat anything-not-an-array as "no rendered".
    invokeMock.mockResolvedValueOnce({
      data: {
        ...PREVIEW_THREAD,
        last_preview: {
          args: PREVIEW_THREAD.last_preview.args,
          rendered: "Day 1\n- Bench Press 4x8\n\nDay 2\n- Barbell Row 4x8",
        },
      },
      error: null,
    })

    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    // No crash; falls back to args-style cards.
    expect(await screen.findByText("Push")).toBeInTheDocument()
    expect(screen.getByText(/2 exercises/i)).toBeInTheDocument()
  })

  it("falls back to args-only rendering when last_preview.rendered is missing (size-guard path)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        ...PREVIEW_THREAD,
        last_preview: {
          args: PREVIEW_THREAD.last_preview.args,
          // rendered intentionally absent
        },
      },
      error: null,
    })

    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    // Day labels still surface, but each day shows the count placeholder
    // instead of MCP echo lines (which we don't have here).
    expect(await screen.findByText("Push")).toBeInTheDocument()
    // "2 exercises" for Push (uuid-1, uuid-2).
    expect(screen.getByText(/2 exercises/i)).toBeInTheDocument()
    // "1 exercises" for Pull. (Tolerate the en string format; we don't
    // pluralize for brevity in T120.)
    expect(screen.getByText(/1 exercises/i)).toBeInTheDocument()
  })

  it("T169: renders Circuit lines and items breakdown when the draft includes a Circuit", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        ...PREVIEW_THREAD,
        last_preview: {
          args: {
            name: "Conditioning — 1 day/wk",
            days: [
              {
                label: "Finisher Day",
                exercises: [
                  "uuid-1",
                  {
                    type: "circuit",
                    label: "Finisher",
                    rounds: 3,
                    exercises: [
                      { exercise_id: "uuid-2", amount: 10, weight_kg: 0 },
                      { exercise_id: "uuid-3", amount: 12, weight_kg: 0 },
                    ],
                  },
                ],
              },
            ],
          },
          rendered: [
            {
              label: "Finisher Day",
              lines: [
                'Circuit "Finisher" — 3 rounds · rest 90s · transition 0s',
                "  Push-up — 10 @ 0 kg",
                "  Swing — 12 @ 16 kg",
              ],
            },
          ],
        },
      },
      error: null,
    })

    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    expect(
      await screen.findByText(/1 days · 2 items \(1 solos · 1 circuits\)/i),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(/2 items \(1 solos · 1 circuits\)/i).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Circuit "Finisher"/i)).toBeInTheDocument()
    expect(screen.getByText(/3 rounds · rest 90s/i)).toBeInTheDocument()
  })

  it("renders the program-shape line: '2 days · 3 exercises'", async () => {
    invokeMock.mockResolvedValueOnce({ data: PREVIEW_THREAD, error: null })

    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    // 2 days, 3 exercises total (Push has 2, Pull has 1).
    expect(await screen.findByText(/2 days · 3 exercises/i)).toBeInTheDocument()
  })

  it("shows a friendly empty state when last_preview is null entirely (drift defense)", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { ...PREVIEW_THREAD, last_preview: null },
      error: null,
    })

    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    expect(
      await screen.findByText(/We couldn't load your draft preview/i),
    ).toBeInTheDocument()
  })
})

describe("EmbeddedAgentPreviewStep — Confirm flow", () => {
  it("clicking Confirm fires /commit with confirm:true and calls onCommitted with the program_id", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: PREVIEW_THREAD, error: null })
      .mockResolvedValueOnce({
        // T136 (#343) — handler now returns thread_id + motivation
        // alongside program_id so the client can fire the new
        // `embedded_agent_preview_committed` event with correlation
        // identifiers.
        data: { program_id: "prog-xyz", thread_id: "thread-pr-1", motivation: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...PREVIEW_THREAD, status: "committed", last_preview: null },
        error: null,
      })

    const onCommitted = vi.fn()
    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={onCommitted}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    const confirmBtn = await screen.findByRole("button", { name: /Confirm and activate/i })
    await userEvent.click(confirmBtn)

    await waitFor(() => expect(onCommitted).toHaveBeenCalledWith("prog-xyz"))
    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
      body: { action: "commit", purpose: "onboarding", confirm: true },
    })
  })

  // T136 (#343) — the dedicated commit event keeps the funnel
  // joinable end-to-end and carries `motivation` for the
  // additional-program flow.
  it("fires embedded_agent_preview_committed on successful commit with thread_id + program_id + motivation + purpose + locale", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: PREVIEW_THREAD, error: null })
      .mockResolvedValueOnce({
        data: { program_id: "prog-AP", thread_id: "thread-pr-1", motivation: "plateau" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...PREVIEW_THREAD, status: "committed", last_preview: null },
        error: null,
      })

    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="additional_program"
        i18nNamespace="create-program"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    const confirmBtn = await screen.findByRole("button", { name: /Activate this program/i })
    await userEvent.click(confirmBtn)

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith({
        eventType: "embedded_agent_preview_committed",
        payload: {
          thread_id: "thread-pr-1",
          program_id: "prog-AP",
          purpose: "additional_program",
          motivation: "plateau",
          locale: "en",
        },
      })
    })
  })

  it("on commit failure (502) keeps the preview visible, shows an error banner with a retry button", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: PREVIEW_THREAD, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: Object.assign(new Error("502"), {
          context: new Response(
            JSON.stringify({ error: "commit_failed", kind: "transport_error" }),
            { status: 502 },
          ),
        }),
      })

    const onCommitted = vi.fn()
    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={onCommitted}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    const confirmBtn = await screen.findByRole("button", { name: /Confirm and activate/i })
    await userEvent.click(confirmBtn)

    expect(
      await screen.findByText(/We couldn't activate your program/i),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument()
    // Preview lines are still on screen — the user didn't lose their draft.
    // The exercise name and tail are split into separate text nodes by the
    // collapsible row layout.
    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(onCommitted).not.toHaveBeenCalled()

    // T122: fatal /commit error is captured in Sentry tagged with the
    // canonical route + error_kind so the dashboard can pair it with
    // server-side `mcp_*` logs.
    await waitFor(() => expect(captureExceptionMock).toHaveBeenCalledTimes(1))
    const callArgs = captureExceptionMock.mock.calls[0]
    expect(callArgs[1]?.tags).toMatchObject({
      feature: "embedded-agent",
      route: "/commit",
      error_kind: "commit_failed",
    })
  })
})

describe("EmbeddedAgentPreviewStep — Regenerate flow", () => {
  it("clicking Regenerate fires /reject and calls onRegenerate so the wizard steps back to chat", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: PREVIEW_THREAD, error: null })
      .mockResolvedValueOnce({ data: { ok: true, status: "open" }, error: null })
      .mockResolvedValueOnce({
        data: { ...PREVIEW_THREAD, status: "open", last_preview: null },
        error: null,
      })

    const onRegenerate = vi.fn()
    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={onRegenerate}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    const regenBtn = await screen.findByRole("button", {
      name: /Regenerate · keep chatting/i,
    })
    await userEvent.click(regenBtn)

    await waitFor(() => expect(onRegenerate).toHaveBeenCalledTimes(1))
    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
      body: { action: "reject", purpose: "onboarding" },
    })
  })

  // T123 analytics: fire on intent (before /reject) so the funnel records
  // the user's choice even if the network call fails. Payload includes
  // thread_id (cross-event correlation) and current failure_count.
  it("fires embedded_agent_preview_rejected with thread_id + failure_count when the user clicks Regenerate", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: PREVIEW_THREAD, error: null })
      .mockResolvedValueOnce({ data: { ok: true, status: "open" }, error: null })
      .mockResolvedValueOnce({
        data: { ...PREVIEW_THREAD, status: "open", last_preview: null },
        error: null,
      })

    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={noop}
        onFallbackBlank={noop}
      />,
    )

    const regenBtn = await screen.findByRole("button", {
      name: /Regenerate · keep chatting/i,
    })
    await userEvent.click(regenBtn)

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith({
        eventType: "embedded_agent_preview_rejected",
        payload: {
          thread_id: "thread-pr-1",
          failure_count: 0,
          // T136 (#343) — `purpose` joined the payload.
          purpose: "onboarding",
        },
      })
    })
  })
})

describe("EmbeddedAgentPreviewStep — 2-failure escape", () => {
  it("after 2 commit failures, surfaces the Template / Blank fallback Alert", async () => {
    // Two consecutive failed commits — sessionStorage counter bumps each
    // time. The Alert surfaces once we cross the threshold.
    const commitErr = Object.assign(new Error("502"), {
      context: new Response(
        JSON.stringify({ error: "commit_failed", kind: "transport_error" }),
        { status: 502 },
      ),
    })
    invokeMock
      .mockResolvedValueOnce({ data: PREVIEW_THREAD, error: null })
      .mockResolvedValueOnce({ data: null, error: commitErr })
      .mockResolvedValueOnce({ data: null, error: commitErr })

    const onFallbackTemplate = vi.fn()
    const onFallbackBlank = vi.fn()
    renderWithProviders(
      <EmbeddedAgentPreviewStep
        locale="en"
        purpose="onboarding"
        i18nNamespace="onboarding"
        onRegenerate={noop}
        onCommitted={noop}
        onFallbackTemplate={onFallbackTemplate}
        onFallbackBlank={onFallbackBlank}
      />,
    )

    const confirmBtn = await screen.findByRole("button", { name: /Confirm and activate/i })
    await userEvent.click(confirmBtn)
    await screen.findByText(/We couldn't activate your program/i)

    // No escape after one failure.
    expect(screen.queryByText(/Stuck\? Try a different path/i)).not.toBeInTheDocument()

    await userEvent.click(confirmBtn)
    expect(await screen.findByText(/Stuck\? Try a different path/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /Pick a template/i }))
    expect(onFallbackTemplate).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole("button", { name: /Start blank/i }))
    expect(onFallbackBlank).toHaveBeenCalledTimes(1)
  })
})
