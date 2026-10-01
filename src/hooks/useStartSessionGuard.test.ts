import { vi, describe, it, expect, beforeEach } from "vitest"
import { act } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { defaultSessionState, type SessionState } from "@/store/atoms"
import { useStartSessionGuard } from "./useStartSessionGuard"

const HOUR = 60 * 60 * 1000

const spies = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  ids: [] as string[],
  closeError: null as { message: string } | null,
}))

const findBlockingOpenSession = vi.hoisted(() => vi.fn())
const resumeOrphanSession = vi.hoisted(() => vi.fn())
const trackSessionEvent = vi.hoisted(() => vi.fn())

vi.mock("@/lib/openSessions", () => ({ findBlockingOpenSession }))
vi.mock("@/lib/resumeSession", () => ({ resumeOrphanSession }))
vi.mock("@/lib/sessionEvents", () => ({ trackSessionEvent }))
vi.mock("@/lib/supabase", () => {
  const chain = {
    update: (payload: Record<string, unknown>) => {
      spies.updates.push(payload)
      return chain
    },
    eq: (_column: string, id: string) => {
      spies.ids.push(id)
      return chain
    },
    is: () => Promise.resolve({ error: spies.closeError }),
  }
  return { supabase: { from: () => chain } }
})

const recentIso = () => new Date(Date.now() - HOUR).toISOString()

const orphan = (id = "orphan-1") => ({
  id,
  workout_day_id: "day-1",
  workout_label_snapshot: "Push",
  started_at: new Date(Date.now() - 2 * HOUR).toISOString(),
  cycle_id: "cycle-1",
  set_logs: [{ logged_at: recentIso() }],
})

function mount(
  overrides: { session?: SessionState; commitStart?: (opts: unknown) => void } = {},
) {
  const commitStart = overrides.commitStart ?? vi.fn()
  const rendered = renderHookWithProviders(() =>
    useStartSessionGuard({
      userId: "u1",
      session: overrides.session ?? defaultSessionState,
      commitStart,
    }),
  )
  return { ...rendered, commitStart }
}

describe("useStartSessionGuard", () => {
  beforeEach(() => {
    spies.updates = []
    spies.ids = []
    spies.closeError = null
    findBlockingOpenSession.mockReset()
    resumeOrphanSession.mockReset()
    trackSessionEvent.mockReset()
  })

  it("commits the start directly when no session is open", async () => {
    findBlockingOpenSession.mockResolvedValue(null)
    const { result, commitStart } = mount()

    await act(async () => {
      await result.current.guard({ skipCycle: true })
    })

    expect(commitStart).toHaveBeenCalledWith({ skipCycle: true })
    expect(result.current.pending).toBeNull()
  })

  it("parks the start and asks when a session is open", async () => {
    findBlockingOpenSession.mockResolvedValue(orphan("s1"))
    const { result, commitStart } = mount()

    await act(async () => {
      await result.current.guard({ skipCycle: true })
    })

    expect(commitStart).not.toHaveBeenCalled()
    expect(result.current.pending?.orphan.id).toBe("s1")
    expect(result.current.pending?.opts).toEqual({ skipCycle: true })
    expect(trackSessionEvent).toHaveBeenCalledWith("session_start_blocked", {
      session_id: "s1",
    })
  })

  it("Finish closes the orphan with its last set, then starts", async () => {
    const row = orphan("s1")
    // First guard call finds s1; the post-close re-run finds nothing.
    findBlockingOpenSession
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(null)
    const { result, commitStart } = mount()

    await act(async () => {
      await result.current.guard({ skipCycle: true })
    })
    await act(async () => {
      await result.current.finish()
    })

    expect(spies.ids).toEqual(["s1"])
    expect(spies.updates[0]).toEqual({
      finished_at: row.set_logs[0].logged_at,
      total_sets_done: 1,
      active_duration_ms: 0,
      has_skipped_sets: false,
    })
    expect(trackSessionEvent).toHaveBeenCalledWith("session_orphan_closed", {
      cause: "start_guard",
      session_id: "s1",
    })
    expect(commitStart).toHaveBeenCalledWith({ skipCycle: true })
    expect(result.current.pending).toBeNull()
  })

  it("keeps the dialog open and does not start when the close fails", async () => {
    findBlockingOpenSession.mockResolvedValue(orphan("s1"))
    spies.closeError = { message: "boom" }
    const { result, commitStart } = mount()

    await act(async () => {
      await result.current.guard({ skipCycle: true })
    })
    await act(async () => {
      await result.current.finish()
    })

    expect(commitStart).not.toHaveBeenCalled()
    expect(result.current.pending?.orphan.id).toBe("s1")
    expect(trackSessionEvent).not.toHaveBeenCalledWith(
      "session_orphan_closed",
      expect.anything(),
    )
  })

  it("re-runs the guard after a close and surfaces a second blocker", async () => {
    findBlockingOpenSession
      .mockResolvedValueOnce(orphan("s1"))
      .mockResolvedValueOnce(orphan("s2"))
    const { result, commitStart } = mount()

    await act(async () => {
      await result.current.guard({ skipCycle: true })
    })
    await act(async () => {
      await result.current.finish()
    })

    expect(commitStart).not.toHaveBeenCalled()
    expect(result.current.pending?.orphan.id).toBe("s2")
  })

  it("Resume reopens the orphan on its day and does not start", async () => {
    const row = orphan("s1")
    findBlockingOpenSession.mockResolvedValue(row)
    const { result, commitStart } = mount()

    await act(async () => {
      await result.current.guard({ skipCycle: true })
    })
    act(() => {
      result.current.resume()
    })

    expect(resumeOrphanSession).toHaveBeenCalledWith(
      {
        id: "s1",
        workout_day_id: "day-1",
        workout_label_snapshot: "Push",
        started_at: row.started_at,
        cycle_id: "cycle-1",
      },
      "u1",
    )
    expect(trackSessionEvent).toHaveBeenCalledWith("session_orphan_resumed", {
      surface: "start_guard",
      session_id: "s1",
    })
    expect(commitStart).not.toHaveBeenCalled()
    expect(result.current.pending).toBeNull()
  })

  it("proceeds with the start when the guard query fails (fail-open)", async () => {
    findBlockingOpenSession.mockRejectedValue(new Error("offline"))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { result, commitStart } = mount()

    await act(async () => {
      await result.current.guard({ skipCycle: true })
    })

    expect(commitStart).toHaveBeenCalledWith({ skipCycle: true })
    expect(result.current.pending).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
