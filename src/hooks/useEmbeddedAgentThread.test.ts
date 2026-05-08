import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { supabase } from "@/lib/supabase"
import {
  useThread,
  useAbandonThread,
  useSendMessage,
  useGenerateDraft,
} from "./useEmbeddedAgentThread"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

const invokeMock = supabase.functions.invoke as unknown as Mock

beforeEach(() => {
  invokeMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useThread", () => {
  it("posts /thread { action: open, locale } and returns the thread payload", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        thread_id: "thread-123",
        status: "open",
        resumed: false,
        messages: [],
      },
      error: null,
    })

    const { result } = renderHookWithProviders(() => useThread("en"))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
      body: { action: "open", locale: "en" },
    })
    expect(result.current.data).toEqual({
      thread_id: "thread-123",
      status: "open",
      resumed: false,
      messages: [],
    })
  })
})

describe("useAbandonThread", () => {
  it("posts /thread { action: abandon } and invalidates the thread query cache", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "t-1", status: "open", resumed: false, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: { thread_id: "t-2", status: "open", resumed: false, messages: [] },
        error: null,
      })

    const { result } = renderHookWithProviders(() => ({
      thread: useThread("en"),
      abandon: useAbandonThread(),
    }))

    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true))
    expect(result.current.thread.data?.thread_id).toBe("t-1")

    await result.current.abandon.mutateAsync()

    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
      body: { action: "abandon" },
    })

    await waitFor(() => expect(result.current.thread.data?.thread_id).toBe("t-2"))
  })
})

describe("useSendMessage", () => {
  it("posts /message with content + locale and returns the assistant payload", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        assistant: { content: "Hello back!", ts: "2026-05-08T12:00:00Z" },
        ready_for_draft: false,
      },
      error: null,
    })

    const { result } = renderHookWithProviders(() => useSendMessage())

    const data = await result.current.mutateAsync({ content: "Hi", locale: "en" })

    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
      body: { action: "send", content: "Hi", locale: "en" },
    })
    expect(data.assistant.content).toBe("Hello back!")
    expect(data.ready_for_draft).toBe(false)
  })

  it("surfaces 429 turn_quota_exceeded as a typed error so the UI can render the cap banner", async () => {
    const quotaError = Object.assign(new Error("Edge Function returned non-2xx status"), {
      context: new Response(
        JSON.stringify({ error: "turn_quota_exceeded", limit: 40, used: 40 }),
        { status: 429 },
      ),
    })
    invokeMock.mockResolvedValueOnce({ data: null, error: quotaError })

    const { result } = renderHookWithProviders(() => useSendMessage())

    let caught: unknown = null
    try {
      await result.current.mutateAsync({ content: "Hi", locale: "en" })
    } catch (err) {
      caught = err
    }

    const isQuotaError =
      typeof caught === "object" &&
      caught !== null &&
      "kind" in caught &&
      (caught as { kind: unknown }).kind === "quota"
    expect(isQuotaError).toBe(true)
  })
})

describe("useGenerateDraft", () => {
  it("posts /draft with trigger + locale and returns the preview payload", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        status: "preview_ready",
        preview: {
          args: { name: "Strength — 4 days/wk", days: [{ label: "Day 1", exercises: ["ex-1"] }] },
          rendered: "Bench Press — 3 × 10 × 0 kg per_hand — 90s rest",
        },
        trigger: "user_cta",
      },
      error: null,
    })

    const { result } = renderHookWithProviders(() => useGenerateDraft())

    const data = await result.current.mutateAsync({ trigger: "user_cta", locale: "en" })

    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
      body: { action: "draft", trigger: "user_cta", locale: "en" },
    })
    expect(data.status).toBe("preview_ready")
    expect(data.preview.args.name).toBe("Strength — 4 days/wk")
  })

  it("maps a 429 draft_quota_exceeded into a typed quota error tagged 'draft'", async () => {
    const err = Object.assign(new Error("429"), {
      context: new Response(
        JSON.stringify({ error: "draft_quota_exceeded", limit: 3, used: 3 }),
        { status: 429 },
      ),
    })
    invokeMock.mockResolvedValueOnce({ data: null, error: err })

    const { result } = renderHookWithProviders(() => useGenerateDraft())

    let caught: unknown = null
    try {
      await result.current.mutateAsync({ trigger: "user_cta", locale: "en" })
    } catch (e) {
      caught = e
    }

    expect(caught).toMatchObject({ kind: "quota", which: "draft", limit: 3, used: 3 })
  })

  it("maps a 429 program_quota_exceeded into a typed quota error tagged 'program'", async () => {
    const err = Object.assign(new Error("429"), {
      context: new Response(
        JSON.stringify({ error: "program_quota_exceeded" }),
        { status: 429 },
      ),
    })
    invokeMock.mockResolvedValueOnce({ data: null, error: err })

    const { result } = renderHookWithProviders(() => useGenerateDraft())

    let caught: unknown = null
    try {
      await result.current.mutateAsync({ trigger: "user_cta", locale: "en" })
    } catch (e) {
      caught = e
    }

    expect(caught).toMatchObject({ kind: "quota", which: "program" })
  })

  it("maps a 502 mcp_failed into a typed model_failure error", async () => {
    const err = Object.assign(new Error("502"), {
      context: new Response(
        JSON.stringify({ error: "mcp_failed", reason: "transport_error" }),
        { status: 502 },
      ),
    })
    invokeMock.mockResolvedValueOnce({ data: null, error: err })

    const { result } = renderHookWithProviders(() => useGenerateDraft())

    let caught: unknown = null
    try {
      await result.current.mutateAsync({ trigger: "user_cta", locale: "en" })
    } catch (e) {
      caught = e
    }

    expect(caught).toMatchObject({ kind: "model_failure" })
  })
})
