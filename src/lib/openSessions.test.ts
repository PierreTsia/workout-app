import { vi, describe, it, expect, beforeEach } from "vitest"

const queuedRealSessionIds = vi.hoisted(() => vi.fn((): Set<string> => new Set()))
const peekSessionRealId = vi.hoisted(() => vi.fn((): string | null => null))
const pruneCancelledSessions = vi.hoisted(() =>
  vi.fn<(userId: string) => Set<string>>(() => new Set()),
)

vi.mock("@/lib/syncService", () => ({
  queuedRealSessionIds,
  peekSessionRealId,
  pruneCancelledSessions,
}))

const rows = vi.hoisted(() => ({ value: [] as unknown[] }))
vi.mock("@/lib/supabase", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    returns: () => Promise.resolve({ data: rows.value, error: null }),
  }
  return { supabase: { from: () => chain } }
})

import {
  classifyOpenSession,
  excludedSessionIds,
  findBlockingOpenSession,
  type OpenSessionRow,
} from "./openSessions"
import { defaultSessionState, type SessionState } from "@/store/atoms"

const HOUR = 60 * 60 * 1000
const NOW = Date.parse("2026-10-01T12:00:00.000Z")

const staleIso = () => new Date(NOW - 13 * HOUR).toISOString()

const row = (id: string, loggedAt: string): OpenSessionRow => ({
  id,
  workout_day_id: "day-1",
  workout_label_snapshot: "Push",
  started_at: new Date(Date.parse(loggedAt) - HOUR).toISOString(),
  cycle_id: "cycle-1",
  set_logs: [{ logged_at: loggedAt }],
})

const session = (overrides: Partial<SessionState> = {}): SessionState => ({
  ...defaultSessionState,
  ...overrides,
})

describe("classifyOpenSession", () => {
  it("classifies a session whose last set is older than the threshold as stale", () => {
    const result = classifyOpenSession([{ logged_at: staleIso() }], NOW)

    expect(result).toEqual({
      kind: "stale",
      close: {
        finishedAt: staleIso(),
        totalSetsDone: 1,
        activeDurationMs: 0,
      },
    })
  })

  it("classifies a session whose last set is inside the threshold as recent", () => {
    const last = new Date(NOW - HOUR).toISOString()

    expect(classifyOpenSession([{ logged_at: last }], NOW)).toEqual({
      kind: "recent",
      lastSetAt: last,
    })
  })

  it("returns null for a session with no sets", () => {
    expect(classifyOpenSession([], NOW)).toBeNull()
  })

  it("returns null when no timestamp is parseable", () => {
    expect(classifyOpenSession([{ logged_at: "not-a-date" }], NOW)).toBeNull()
  })
})

describe("excludedSessionIds", () => {
  beforeEach(() => {
    queuedRealSessionIds.mockReturnValue(new Set())
    peekSessionRealId.mockReturnValue(null)
    pruneCancelledSessions.mockReturnValue(new Set())
  })

  it("excludes the active local session, the queue, and the deny-list", () => {
    queuedRealSessionIds.mockReturnValue(new Set(["queued"]))
    pruneCancelledSessions.mockReturnValue(new Set(["cancelled"]))
    peekSessionRealId.mockReturnValue("active")

    const excluded = excludedSessionIds(
      "u1",
      session({ isActive: true, startedAt: 1_700_000_000_000 }),
    )

    expect(excluded).toEqual(new Set(["queued", "cancelled", "active"]))
    expect(peekSessionRealId).toHaveBeenCalledWith("u1", "local-1700000000000")
  })
})

describe("findBlockingOpenSession", () => {
  beforeEach(() => {
    rows.value = []
    queuedRealSessionIds.mockReturnValue(new Set())
    peekSessionRealId.mockReturnValue(null)
    pruneCancelledSessions.mockReturnValue(new Set())
  })

  it("returns the first open row that is not excluded", async () => {
    rows.value = [row("excluded", staleIso()), row("blocking", staleIso())]
    queuedRealSessionIds.mockReturnValue(new Set(["excluded"]))

    const blocking = await findBlockingOpenSession("u1", session())

    expect(blocking?.id).toBe("blocking")
  })

  it("returns null when every open row is excluded", async () => {
    rows.value = [row("excluded", staleIso())]
    queuedRealSessionIds.mockReturnValue(new Set(["excluded"]))

    expect(await findBlockingOpenSession("u1", session())).toBeNull()
  })
})
