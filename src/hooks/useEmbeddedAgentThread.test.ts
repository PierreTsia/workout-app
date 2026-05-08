import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { supabase } from "@/lib/supabase"
import {
  useThread,
  useAbandonThread,
  useSendMessage,
  useGenerateDraft,
  useRejectPreview,
  useCommitPreview,
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
          rendered: [
            { label: "Day 1", lines: ["Bench Press — 3 × 10 × 0 kg per_hand — 90s rest"] },
          ],
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

describe("useRejectPreview", () => {
  it("posts /reject and invalidates the thread cache so the consumer re-fetches the now-open thread", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: {
          thread_id: "t-1",
          status: "preview_ready",
          resumed: true,
          messages: [{ role: "user", content: "hi", ts: "x" }],
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true, status: "open" }, error: null })
      .mockResolvedValueOnce({
        data: { thread_id: "t-1", status: "open", resumed: true, messages: [] },
        error: null,
      })

    const { result } = renderHookWithProviders(() => ({
      thread: useThread("en"),
      reject: useRejectPreview(),
    }))

    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true))
    expect(result.current.thread.data?.status).toBe("preview_ready")

    await result.current.reject.mutateAsync()

    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", { body: { action: "reject" } })

    // Cache invalidation refetches and surfaces the now-open thread.
    await waitFor(() => expect(result.current.thread.data?.status).toBe("open"))
  })
})

describe("useCommitPreview", () => {
  it("posts /commit { confirm: true } automatically (UI never has to think about the gate) and returns program_id", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { program_id: "prog-abc" },
      error: null,
    })

    const { result } = renderHookWithProviders(() => useCommitPreview())

    const data = await result.current.mutateAsync()

    expect(invokeMock).toHaveBeenCalledWith("embedded-agent", {
      body: { action: "commit", confirm: true },
    })
    expect(data.program_id).toBe("prog-abc")
  })

  it("syncs hasProgramAtom + activeProgramIdAtom and invalidates program-related caches on success (parity with legacy AIProgramPreviewStep)", async () => {
    // Without this sync the user navigates to "/" but the home shell still
    // thinks they have no program (atom=false) → infinite redirect loop or
    // empty home. The legacy AI flow does this from the component; we do it
    // from the hook so any caller of useCommitPreview gets it for free.
    const { hasProgramAtom, activeProgramIdAtom } = await import("@/store/atoms")

    invokeMock.mockResolvedValueOnce({ data: { program_id: "prog-sync-1" }, error: null })

    const { result, store, queryClient } = renderHookWithProviders(() =>
      useCommitPreview(),
    )
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    store.set(hasProgramAtom, false)
    store.set(activeProgramIdAtom, null)

    await result.current.mutateAsync()

    expect(store.get(hasProgramAtom)).toBe(true)
    expect(store.get(activeProgramIdAtom)).toBe("prog-sync-1")

    // Caches the home shell + program pages depend on must be invalidated
    // so the navigation to "/" lands on fresh data.
    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (c) => (c[0] as { queryKey: readonly unknown[] })?.queryKey?.[0],
    )
    expect(invalidatedKeys).toContain("workout-days")
    expect(invalidatedKeys).toContain("active-program")
    expect(invalidatedKeys).toContain("user-programs")
  })

  it("invalidates the thread cache after a successful commit so consumers see the committed status", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { thread_id: "t-1", status: "preview_ready", resumed: true, messages: [] },
        error: null,
      })
      .mockResolvedValueOnce({ data: { program_id: "prog-1" }, error: null })
      .mockResolvedValueOnce({
        data: { thread_id: "t-1", status: "committed", resumed: true, messages: [] },
        error: null,
      })

    const { result } = renderHookWithProviders(() => ({
      thread: useThread("en"),
      commit: useCommitPreview(),
    }))

    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true))

    await result.current.commit.mutateAsync()

    await waitFor(() => expect(result.current.thread.data?.status).toBe("committed"))
  })

  it("maps a 502 commit_failed into a typed commit_failed error so the UI can show retry without losing the preview", async () => {
    const err = Object.assign(new Error("502"), {
      context: new Response(
        JSON.stringify({ error: "commit_failed", kind: "transport_error" }),
        { status: 502 },
      ),
    })
    invokeMock.mockResolvedValueOnce({ data: null, error: err })

    const { result } = renderHookWithProviders(() => useCommitPreview())

    let caught: unknown = null
    try {
      await result.current.mutateAsync()
    } catch (e) {
      caught = e
    }

    expect(caught).toMatchObject({ kind: "commit_failed" })
  })

  it("maps state-violation 409s (no_active_thread, not_preview_ready, no_preview) into a typed no_active_thread error", async () => {
    // All three 409 codes mean "your client state has drifted from the
    // server" — the UI should bail back to chat and let the user start over.
    // We collapse them to a single `no_active_thread` kind so the consumer
    // doesn't have to switch on three near-identical conditions.
    for (const code of ["no_active_thread", "not_preview_ready", "no_preview"]) {
      invokeMock.mockResolvedValueOnce({
        data: null,
        error: Object.assign(new Error("409"), {
          context: new Response(JSON.stringify({ error: code }), { status: 409 }),
        }),
      })

      const { result } = renderHookWithProviders(() => useCommitPreview())

      let caught: unknown = null
      try {
        await result.current.mutateAsync()
      } catch (e) {
        caught = e
      }

      expect(caught).toMatchObject({ kind: "no_active_thread" })
    }
  })
})
