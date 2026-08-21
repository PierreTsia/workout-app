import { describe, expect, it } from "vitest"
import type { AmrapScoreCell } from "@/lib/amrapScore"
import { circuitLedger, parseCircuitLedgerPayload, type CircuitLedgerRun } from "./circuitLedger"

const TZ_NOW = new Date(2026, 7, 21, 12, 0, 0)

function cindyCells(
  sessionId: string,
  fullRounds: number,
  leftover: number,
): AmrapScoreCell[] {
  return [
    {
      session_id: sessionId,
      set_number: fullRounds + 1,
      reps_logged: String(leftover),
      duration_seconds: null,
      logged_at: "2026-08-21T10:19:50.000Z",
      exercise_name: "pull-ups",
    },
  ]
}

function makeCindy(
  overrides: Partial<Extract<CircuitLedgerRun, { mode: "amrap" }>> & {
    sessionId: string
    startedAt: string
    fullRounds: number
    leftover?: number
  },
): CircuitLedgerRun {
  const leftover = overrides.leftover ?? 0
  return {
    mode: "amrap",
    sessionId: overrides.sessionId,
    startedAt: overrides.startedAt,
    finishedAt: overrides.finishedAt ?? "2026-08-21T10:20:00.000Z",
    fingerprint: overrides.fingerprint ?? "amrap|1200|cindy",
    catalogId: overrides.catalogId === undefined ? "cindy-id" : overrides.catalogId,
    name: overrides.name ?? "Cindy",
    capSeconds: overrides.capSeconds ?? 1200,
    cells: overrides.cells ?? cindyCells(overrides.sessionId, overrides.fullRounds, leftover),
  }
}

describe("circuitLedger Profil Circuit PB", () => {
  it("does not mark the first complete Cindy as a PB; a later career-best in the window is", () => {
    const firstOnly = circuitLedger(
      [
        makeCindy({
          sessionId: "s1",
          startedAt: "2026-08-20T09:00:00.000Z",
          fullRounds: 10,
          leftover: 1,
        }),
      ],
      { kind: "7", now: TZ_NOW },
    )

    expect(firstOnly.status).toBe("ok")
    expect(firstOnly.pulse.pbs).toBe(0)
    expect(firstOnly.rows[0]?.pb).toBe(false)

    const afterABest = circuitLedger(
      [
        makeCindy({
          sessionId: "s1",
          startedAt: "2026-08-14T09:00:00.000Z",
          fullRounds: 8,
          leftover: 0,
        }),
        makeCindy({
          sessionId: "s2",
          startedAt: "2026-08-20T09:00:00.000Z",
          fullRounds: 10,
          leftover: 1,
        }),
      ],
      { kind: "7", now: TZ_NOW },
    )

    expect(afterABest.pulse.pbs).toBe(1)
    expect(afterABest.rows[0]?.pb).toBe(true)
    expect(afterABest.rows[0]?.mode === "amrap" && afterABest.rows[0].best).toEqual({
      fullRounds: 10,
      leftover: 1,
      leftoverName: "pull-ups",
    })
  })

  it("scores the window best, not the last run", () => {
    const vm = circuitLedger(
      [
        makeCindy({
          sessionId: "s1",
          startedAt: "2026-08-16T09:00:00.000Z",
          fullRounds: 8,
          leftover: 2,
        }),
        makeCindy({
          sessionId: "s2",
          startedAt: "2026-08-18T09:00:00.000Z",
          fullRounds: 10,
          leftover: 1,
        }),
        makeCindy({
          sessionId: "s3",
          startedAt: "2026-08-20T09:00:00.000Z",
          fullRounds: 9,
          leftover: 0,
        }),
      ],
      { kind: "7", now: TZ_NOW },
    )

    expect(vm.rows[0]?.mode === "amrap" && vm.rows[0].best).toEqual({
      fullRounds: 10,
      leftover: 1,
      leftoverName: "pull-ups",
    })
    expect(vm.rows[0]?.runCount).toBe(3)
  })

  it("drops jetable runs from the ledger", () => {
    const vm = circuitLedger(
      [
        makeCindy({
          sessionId: "jetable",
          startedAt: "2026-08-20T09:00:00.000Z",
          fullRounds: 12,
          leftover: 0,
          catalogId: null,
          fingerprint: "amrap|1200|jetable",
          name: "Throwaway",
        }),
        makeCindy({
          sessionId: "cindy",
          startedAt: "2026-08-19T09:00:00.000Z",
          fullRounds: 9,
          leftover: 0,
        }),
      ],
      { kind: "7", now: TZ_NOW },
    )

    expect(vm.rows.map((row) => row.name)).toEqual(["Cindy"])
    expect(vm.pulse.runs).toBe(1)
    expect(vm.pulse.distinct).toBe(1)
  })

  it("counts a career PB older than the last-8 sparkline when the window still contains that day", () => {
    const olderBest = makeCindy({
      sessionId: "pb",
      startedAt: "2026-06-01T09:00:00.000Z",
      fullRounds: 20,
      leftover: 0,
    })
    const later = Array.from({ length: 8 }, (_, i) =>
      makeCindy({
        sessionId: `later-${i}`,
        startedAt: `2026-08-${String(10 + i).padStart(2, "0")}T09:00:00.000Z`,
        fullRounds: 10 + i,
        leftover: 0,
      }),
    )
    const vm = circuitLedger([olderBest, ...later], { kind: "100", now: TZ_NOW })

    expect(vm.pulse.pbs).toBe(1)
    expect(vm.rows[0]?.pb).toBe(true)
    expect(vm.rows[0]?.runCount).toBe(9)
    expect(vm.rows[0]?.sparkValues).toEqual([10, 11, 12, 13, 14, 15, 16, 17])
    expect(vm.rows[0]?.mode === "amrap" && vm.rows[0].best.fullRounds).toBe(20)
  })

  it("keeps best score and run count when a fingerprint has a single run", () => {
    const vm = circuitLedger(
      [
        makeCindy({
          sessionId: "only",
          startedAt: "2026-08-20T09:00:00.000Z",
          fullRounds: 9,
          leftover: 3,
        }),
      ],
      { kind: "7", now: TZ_NOW },
    )

    expect(vm.rows).toHaveLength(1)
    expect(vm.rows[0]?.runCount).toBe(1)
    expect(vm.rows[0]?.sparkValues).toEqual([9])
    expect(vm.rows[0]?.mode === "amrap" && vm.rows[0].best).toEqual({
      fullRounds: 9,
      leftover: 3,
      leftoverName: "pull-ups",
    })
    expect(vm.rows[0]?.pb).toBe(false)
  })
})

function makeTours(
  overrides: Partial<Extract<CircuitLedgerRun, { mode: "rounds" }>> & {
    sessionId: string
    startedAt: string
    seconds: number
  },
): CircuitLedgerRun {
  return {
    mode: "rounds",
    sessionId: overrides.sessionId,
    startedAt: overrides.startedAt,
    fingerprint: overrides.fingerprint ?? "rounds|4|force",
    catalogId: overrides.catalogId === undefined ? "force-id" : overrides.catalogId,
    name: overrides.name ?? "Force",
    rounds: overrides.rounds ?? 4,
    seconds: overrides.seconds,
    isComplete: overrides.isComplete ?? true,
  }
}

describe("circuitLedger Tours scoring", () => {
  it("uses min completion time as the window best, and first complete is not a PB", () => {
    const firstOnly = circuitLedger(
      [
        makeTours({
          sessionId: "t1",
          startedAt: "2026-08-20T09:00:00.000Z",
          seconds: 520,
        }),
      ],
      { kind: "7", now: TZ_NOW },
    )
    expect(firstOnly.rows[0]?.pb).toBe(false)
    expect(firstOnly.rows[0]?.mode).toBe("rounds")
    expect(firstOnly.rows[0]?.mode === "rounds" && firstOnly.rows[0].best).toEqual({
      seconds: 520,
    })

    const laterFaster = circuitLedger(
      [
        makeTours({
          sessionId: "t1",
          startedAt: "2026-08-16T09:00:00.000Z",
          seconds: 520,
        }),
        makeTours({
          sessionId: "t2",
          startedAt: "2026-08-18T09:00:00.000Z",
          seconds: 478,
        }),
        makeTours({
          sessionId: "t3",
          startedAt: "2026-08-20T09:00:00.000Z",
          seconds: 498,
        }),
      ],
      { kind: "7", now: TZ_NOW },
    )
    expect(laterFaster.pulse.pbs).toBe(1)
    expect(laterFaster.rows[0]?.pb).toBe(true)
    expect(laterFaster.rows[0]?.mode === "rounds" && laterFaster.rows[0].best).toEqual({
      seconds: 478,
    })
    expect(laterFaster.rows[0]?.sparkValues).toEqual([520, 478, 498])
  })
})

describe("circuitLedger pulse deltas", () => {
  it("compares run counts to the equal prior window", () => {
    const vm = circuitLedger(
      [
        makeCindy({
          sessionId: "prior",
          startedAt: "2026-08-10T09:00:00.000Z",
          fullRounds: 8,
          leftover: 0,
        }),
        makeCindy({
          sessionId: "now-a",
          startedAt: "2026-08-18T09:00:00.000Z",
          fullRounds: 9,
          leftover: 0,
        }),
        makeCindy({
          sessionId: "now-b",
          startedAt: "2026-08-20T09:00:00.000Z",
          fullRounds: 10,
          leftover: 0,
        }),
      ],
      { kind: "7", now: TZ_NOW },
    )

    expect(vm.pulse.runs).toBe(2)
    expect(vm.pulse.runsDelta).toBe(1)
  })
})

describe("parseCircuitLedgerPayload", () => {
  it("reads catalog AMRAP score inputs and drops a null catalog id", () => {
    const runs = parseCircuitLedgerPayload([
      {
        session_id: "s1",
        started_at: "2026-08-20T09:00:00.000Z",
        finished_at: "2026-08-20T09:20:00.000Z",
        template_fingerprint: "amrap|1200|cindy",
        benchmark_circuit_id: "cindy-id",
        mode: "amrap",
        cap_seconds: 1200,
        label: "Cindy",
        cells: [
          {
            session_id: "s1",
            set_number: 11,
            reps_logged: "1",
            duration_seconds: null,
            logged_at: "2026-08-20T09:19:50.000Z",
            exercise_name: "pull-ups",
          },
        ],
      },
      {
        session_id: "jetable",
        started_at: "2026-08-20T10:00:00.000Z",
        finished_at: "2026-08-20T10:20:00.000Z",
        template_fingerprint: "amrap|1200|x",
        benchmark_circuit_id: null,
        mode: "amrap",
        cap_seconds: 1200,
        label: "Throwaway",
        cells: [],
      },
    ])

    expect(runs).toHaveLength(1)
    expect(runs[0]).toEqual({
      mode: "amrap",
      sessionId: "s1",
      startedAt: "2026-08-20T09:00:00.000Z",
      finishedAt: "2026-08-20T09:20:00.000Z",
      fingerprint: "amrap|1200|cindy",
      catalogId: "cindy-id",
      name: "Cindy",
      capSeconds: 1200,
      cells: [
        {
          session_id: "s1",
          set_number: 11,
          reps_logged: "1",
          duration_seconds: null,
          logged_at: "2026-08-20T09:19:50.000Z",
          exercise_name: "pull-ups",
        },
      ],
    })
  })
})

const ledgerMigrations: Record<string, string> = import.meta.glob(
  "../../../supabase/migrations/*get_profile_circuit_ledger*.sql",
  { query: "?raw", eager: true, import: "default" },
)

describe("get_profile_circuit_ledger migration", () => {
  it("ships an unbounded catalog ledger as SECURITY INVOKER for auth.uid()", () => {
    const sql = Object.values(ledgerMigrations).join("\n")
    expect(sql.length).toBeGreaterThan(0)
    expect(sql).toMatch(/SECURITY\s+INVOKER/i)
    expect(sql).toMatch(/user_id\s*=\s*auth\.uid\(\)/i)
    expect(sql).toMatch(/benchmark_circuit_id\s+IS\s+NOT\s+NULL/i)
    expect(sql).not.toMatch(/LIMIT\s+8/i)
    expect(sql).not.toMatch(/RUN_LIMIT/i)
  })
})
