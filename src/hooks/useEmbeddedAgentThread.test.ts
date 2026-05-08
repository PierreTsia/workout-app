import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { supabase } from "@/lib/supabase"
import {
  useThread,
  useAbandonThread,
  useSendMessage,
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
