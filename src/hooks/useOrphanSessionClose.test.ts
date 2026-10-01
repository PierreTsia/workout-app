import { vi, describe, it, expect, beforeEach } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom, sessionAtom, defaultSessionState } from "@/store/atoms"
import { useOrphanSessionClose } from "./useOrphanSessionClose"

const HOUR = 60 * 60 * 1000

const spies = vi.hoisted(() => ({
  rows: [] as unknown[],
  updates: [] as Record<string, unknown>[],
  ids: [] as string[],
  closeError: null as { message: string } | null,
}))

const queuedRealSessionIds = vi.hoisted(() => vi.fn((): Set<string> => new Set()))
const peekSessionRealId = vi.hoisted(() => vi.fn((): string | null => null))
const pruneCancelledSessions = vi.hoisted(() =>
  vi.fn<(userId: string) => Set<string>>(() => new Set()),
)
const trackSessionEvent = vi.hoisted(() => vi.fn())
const resumeOrphanSession = vi.hoisted(() => vi.fn())

vi.mock("@/lib/syncService", () => ({
  queuedRealSessionIds,
  peekSessionRealId,
  pruneCancelledSessions,
}))

vi.mock("@/lib/sessionEvents", () => ({ trackSessionEvent }))

vi.mock("@/lib/resumeSession", () => ({ resumeOrphanSession }))

vi.mock("@/lib/supabase", () => {
  const selectChain = {
    select: () => selectChain,
    eq: () => selectChain,
    is: () => selectChain,
    returns: () => Promise.resolve({ data: spies.rows, error: null }),
  }
  const updateChain = {
    update: (payload: Record<string, unknown>) => {
      spies.updates.push(payload)
      return updateChain
    },
    eq: (_column: string, id: string) => {
      spies.ids.push(id)
      return updateChain
    },
    is: () => updateChain,
    then: (resolve: (v: { data: unknown[]; error: unknown }) => void) =>
      resolve({ data: spies.rows, error: spies.closeError }),
  }
  return {
    supabase: {
      from: () => ({ select: selectChain.select, update: updateChain.update }),
    },
  }
})

const oldIso = () => new Date(Date.now() - 13 * HOUR).toISOString()
const recentIso = () => new Date(Date.now() - HOUR).toISOString()

const orphan = (id: string, loggedAt: string) => ({
  id,
  workout_day_id: "day-1",
  workout_label_snapshot: "Push",
  started_at: new Date(new Date(loggedAt).getTime() - HOUR).toISOString(),
  cycle_id: "cycle-1",
  set_logs: [{ logged_at: loggedAt }],
})

function mount() {
  const rendered = renderHookWithProviders(() => useOrphanSessionClose())
  act(() => {
    rendered.store.set(authAtom, { id: "u1" } as never)
  })
  return rendered
}

describe("useOrphanSessionClose", () => {
  beforeEach(() => {
    spies.rows = []
    spies.updates = []
    spies.ids = []
    spies.closeError = null
    queuedRealSessionIds.mockReturnValue(new Set())
    peekSessionRealId.mockReturnValue(null)
    pruneCancelledSessions.mockReturnValue(new Set())
    trackSessionEvent.mockClear()
    resumeOrphanSession.mockClear()
  })

  it("closes a stale orphan with the last set — never now()", async () => {
    const last = oldIso()
    spies.rows = [orphan("s1", last)]

    mount()

    await waitFor(() => expect(spies.updates).toHaveLength(1))
    expect(spies.ids).toEqual(["s1"])
    expect(spies.updates[0]).toEqual({
      finished_at: last,
      total_sets_done: 1,
      active_duration_ms: 0,
      has_skipped_sets: false,
    })
    expect(trackSessionEvent).toHaveBeenCalledWith("session_orphan_closed", {
      cause: "auto",
      session_id: "s1",
      idle_ms: expect.any(Number),
      total_sets_done: 1,
    })
  })

  it("exposes a recent orphan, emits the prompt, and does not close it", async () => {
    const last = recentIso()
    spies.rows = [orphan("s1", last)]

    const { result } = mount()

    await waitFor(() => expect(result.current.recentOrphan?.id).toBe("s1"))
    expect(result.current.recentOrphan?.lastSetAt).toBe(last)
    expect(spies.updates).toHaveLength(0)
    expect(trackSessionEvent).toHaveBeenCalledWith("session_orphan_prompted", {
      surface: "app_open",
    })
  })

  it("finish() closes the recent orphan with the last set and cause open_prompt", async () => {
    const last = recentIso()
    spies.rows = [orphan("s1", last)]

    const { result } = mount()
    await waitFor(() => expect(result.current.recentOrphan?.id).toBe("s1"))

    act(() => {
      result.current.finish()
    })

    await waitFor(() => expect(spies.updates).toHaveLength(1))
    expect(spies.ids).toEqual(["s1"])
    expect(spies.updates[0]).toEqual({
      finished_at: last,
      total_sets_done: 1,
      active_duration_ms: 0,
      has_skipped_sets: false,
    })
    expect(trackSessionEvent).toHaveBeenCalledWith("session_orphan_closed", {
      cause: "open_prompt",
      session_id: "s1",
      total_sets_done: 1,
    })
    await waitFor(() => expect(result.current.recentOrphan).toBeNull())
  })

  it("keeps the prompt open when the close fails", async () => {
    const last = recentIso()
    spies.rows = [orphan("s1", last)]
    spies.closeError = { message: "boom" }

    const { result } = mount()
    await waitFor(() => expect(result.current.recentOrphan?.id).toBe("s1"))

    await act(async () => {
      await result.current.finish()
    })

    expect(result.current.recentOrphan?.id).toBe("s1")
    expect(trackSessionEvent).not.toHaveBeenCalledWith(
      "session_orphan_closed",
      expect.anything(),
    )
  })

  it("resume() reopens the orphan on its day and emits resumed", async () => {
    const last = recentIso()
    spies.rows = [orphan("s1", last)]

    const { result } = mount()
    await waitFor(() => expect(result.current.recentOrphan?.id).toBe("s1"))

    act(() => {
      result.current.resume()
    })

    expect(resumeOrphanSession).toHaveBeenCalledWith(
      {
        id: "s1",
        workout_day_id: "day-1",
        workout_label_snapshot: "Push",
        started_at: expect.any(String),
        cycle_id: "cycle-1",
      },
      "u1",
    )
    expect(trackSessionEvent).toHaveBeenCalledWith("session_orphan_resumed", {
      surface: "app_open",
    })
    await waitFor(() => expect(result.current.recentOrphan).toBeNull())
  })

  it("dismiss() clears the prompt and leaves the row open", async () => {
    spies.rows = [orphan("s1", recentIso())]

    const { result } = mount()
    await waitFor(() => expect(result.current.recentOrphan?.id).toBe("s1"))

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.recentOrphan).toBeNull()
    expect(spies.updates).toHaveLength(0)
  })

  it("does not prompt while a local session is active", async () => {
    spies.rows = [orphan("s1", recentIso())]

    const rendered = renderHookWithProviders(() => useOrphanSessionClose())
    act(() => {
      rendered.store.set(authAtom, { id: "u1" } as never)
      rendered.store.set(sessionAtom, {
        ...defaultSessionState,
        isActive: true,
        startedAt: 1_700_000_000_000,
      })
    })

    // Wait for the effect to have run, then assert no prompt was surfaced.
    await waitFor(() => expect(queuedRealSessionIds).toHaveBeenCalled())
    expect(rendered.result.current.recentOrphan).toBeNull()
    expect(trackSessionEvent).not.toHaveBeenCalledWith(
      "session_orphan_prompted",
      expect.anything(),
    )
  })

  it("leaves a recent session alone (possibly still in progress)", async () => {
    spies.rows = [orphan("s1", recentIso())]

    mount()

    // Wait for the effect to have run (it calls the queue guard), then assert
    // nothing was written — a bare "not called" would pass before the query
    // even resolved.
    await waitFor(() => expect(queuedRealSessionIds).toHaveBeenCalled())
    expect(spies.updates).toHaveLength(0)
  })

  it("never closes the active local session", async () => {
    spies.rows = [orphan("active", oldIso())]
    peekSessionRealId.mockReturnValue("active")

    const rendered = renderHookWithProviders(() => useOrphanSessionClose())
    act(() => {
      rendered.store.set(authAtom, { id: "u1" } as never)
      rendered.store.set(sessionAtom, {
        ...defaultSessionState,
        isActive: true,
        startedAt: 1_700_000_000_000,
      })
    })

    await waitFor(() => expect(peekSessionRealId).toHaveBeenCalled())
    expect(spies.updates).toHaveLength(0)
  })

  it("never closes a session the offline queue still owns", async () => {
    spies.rows = [orphan("queued", oldIso())]
    queuedRealSessionIds.mockReturnValue(new Set(["queued"]))

    mount()

    await waitFor(() => expect(queuedRealSessionIds).toHaveBeenCalled())
    expect(spies.updates).toHaveLength(0)
  })

  it("never closes a session the user cancelled (offline delete may have failed)", async () => {
    spies.rows = [orphan("cancelled", oldIso())]
    pruneCancelledSessions.mockReturnValue(new Set(["cancelled"]))

    mount()

    await waitFor(() => expect(pruneCancelledSessions).toHaveBeenCalledWith("u1"))
    expect(spies.updates).toHaveLength(0)
  })

  it("closes each eligible orphan once and only once per mount", async () => {
    spies.rows = [orphan("s1", oldIso()), orphan("s2", oldIso())]

    const { rerender } = mount()

    await waitFor(() => expect(spies.updates).toHaveLength(2))
    rerender()

    await waitFor(() => expect(spies.ids).toEqual(["s1", "s2"]))
    expect(spies.updates).toHaveLength(2)
  })
})
