import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { supabase } from "@/lib/supabase"
import {
  useThread,
  useAbandonThread,
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
