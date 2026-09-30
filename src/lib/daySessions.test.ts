import { describe, expect, it } from "vitest"
import { sessionsForDay } from "./daySessions"
import type { Session } from "@/types/database"

const session = (over: Partial<Session>): Session => ({
  id: "s1",
  user_id: "u1",
  workout_day_id: null,
  workout_label_snapshot: "Lundi",
  started_at: "2026-06-15T10:00:00.000Z",
  finished_at: "2026-06-15T11:00:00.000Z",
  active_duration_ms: 3_600_000,
  total_sets_done: 3,
  has_skipped_sets: false,
  cycle_id: null,
  ...over,
})

describe("sessionsForDay", () => {
  it("keeps a finished session on its finish day", () => {
    const rows = sessionsForDay([session({})], "2026-06-15", "UTC")
    expect(rows).toHaveLength(1)
  })

  it("keeps an unfinished session (no finished_at) instead of hiding it", () => {
    const rows = sessionsForDay(
      [session({ finished_at: null, total_sets_done: 0 })],
      "2026-06-15",
      "UTC",
    )
    expect(rows).toHaveLength(1)
  })

  it("buckets an unfinished session on its start when the finish never landed", () => {
    const rows = sessionsForDay(
      [session({ finished_at: null, started_at: "2026-06-16T08:00:00.000Z" })],
      "2026-06-15",
      "UTC",
    )
    expect(rows).toHaveLength(0)
  })

  it("drops sessions on other days", () => {
    const rows = sessionsForDay([session({})], "2026-06-16", "UTC")
    expect(rows).toHaveLength(0)
  })
})
