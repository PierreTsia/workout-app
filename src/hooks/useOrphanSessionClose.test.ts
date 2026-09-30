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
}))

const queuedRealSessionIds = vi.hoisted(() => vi.fn((): Set<string> => new Set()))
const peekSessionRealId = vi.hoisted(() => vi.fn((): string | null => null))

vi.mock("@/lib/syncService", () => ({
  queuedRealSessionIds,
  peekSessionRealId,
}))

vi.mock("@/lib/supabase", () => {
  const chain = {
    select: () => chain,
    is: () => Promise.resolve({ data: spies.rows, error: null }),
    update: (payload: Record<string, unknown>) => {
      spies.updates.push(payload)
      return chain
    },
    eq: (_column: string, id: string) => {
      spies.ids.push(id)
      return chain
    },
  }
  return { supabase: { from: () => chain } }
})

const oldIso = () => new Date(Date.now() - 13 * HOUR).toISOString()
const recentIso = () => new Date(Date.now() - HOUR).toISOString()

const orphan = (id: string, loggedAt: string) => ({
  id,
  started_at: new Date(new Date(loggedAt).getTime() - HOUR).toISOString(),
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
    queuedRealSessionIds.mockReturnValue(new Set())
    peekSessionRealId.mockReturnValue(null)
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
  })

  it("leaves a recent session alone (possibly still in progress)", async () => {
    spies.rows = [orphan("s1", recentIso())]

    mount()

    await waitFor(() => expect(peekSessionRealId).toHaveBeenCalledTimes(0))
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

  it("closes each eligible orphan once and only once per mount", async () => {
    spies.rows = [orphan("s1", oldIso()), orphan("s2", oldIso())]

    const { rerender } = mount()

    await waitFor(() => expect(spies.updates).toHaveLength(2))
    rerender()

    await waitFor(() => expect(spies.ids).toEqual(["s1", "s2"]))
    expect(spies.updates).toHaveLength(2)
  })
})
