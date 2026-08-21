import { describe, expect, it } from "vitest"
import {
  buildPulseVmFromRollups,
  buildRecordsVmFromRollups,
  buildRhythmVmFromRollups,
  buildTonnageVmFromRollups,
  parseProfileAllTimeRollups,
  regularsFromRollups,
} from "./allTimeRollups"
import type { ProfileAllTimeRollups, YearRollup } from "./types"

function year(overrides: Partial<YearRollup> & Pick<YearRollup, "year">): YearRollup {
  return {
    mix: { programme: 0, quickWorkout: 0, circuits: 0 },
    tonnage_kg: 0,
    pr_pairs: 0,
    rir0_num: 0,
    rir0_den: 0,
    session_count: 0,
    duration_ms: 0,
    ...overrides,
  }
}

function rollups(
  years: YearRollup[],
  extra: Partial<ProfileAllTimeRollups> = {},
): ProfileAllTimeRollups {
  return {
    years,
    program_ids: [],
    regulars: [],
    pr_exercise_count: 0,
    last_pr_day: null,
    ...extra,
  }
}

describe("parseProfileAllTimeRollups", () => {
  it("keeps year buckets and skinny career extras, not set_logs", () => {
    const parsed = parseProfileAllTimeRollups({
      years: [
        {
          year: 2024,
          mix: { programme: 10, quickWorkout: 2, circuits: 1 },
          tonnage_kg: "1400.5",
          pr_pairs: 8,
          rir0_num: 2,
          rir0_den: 20,
          session_count: 13,
          duration_ms: 13 * 40 * 60_000,
        },
      ],
      program_ids: ["upper-lower", "ppl"],
      regulars: [
        { exercise_id: "squat", reps: 400, last_logged_at: "2024-12-01T11:00:00.000Z" },
      ],
      pr_exercise_count: 6,
      last_pr_day: "2024-11-02",
    })

    expect(parsed.years).toHaveLength(1)
    expect(parsed.years[0]?.tonnage_kg).toBe(1400.5)
    expect(parsed.program_ids).toEqual(["upper-lower", "ppl"])
    expect(parsed.regulars[0]?.reps).toBe(400)
    expect(parsed.pr_exercise_count).toBe(6)
    expect(parsed.last_pr_day).toBe("2024-11-02")
  })
})

describe("all-time VMs from year rollups", () => {
  const career = rollups(
    [
      year({
        year: 2024,
        mix: { programme: 10, quickWorkout: 2, circuits: 1 },
        tonnage_kg: 4000,
        pr_pairs: 8,
        rir0_num: 2,
        rir0_den: 20,
        session_count: 13,
        duration_ms: 13 * 40 * 60_000,
      }),
      year({
        year: 2026,
        mix: { programme: 4, quickWorkout: 1, circuits: 0 },
        tonnage_kg: 2000,
        pr_pairs: 3,
        rir0_num: 1,
        rir0_den: 10,
        session_count: 5,
        duration_ms: 5 * 40 * 60_000,
      }),
    ],
    {
      pr_exercise_count: 7,
      last_pr_day: "2026-08-19",
      regulars: [
        { exercise_id: "squat", reps: 1240, last_logged_at: "2026-08-01T11:00:00.000Z" },
      ],
    },
  )

  it("builds pulse totals with no vs-prior deltas", () => {
    const vm = buildPulseVmFromRollups(career, 60)
    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.sessions).toBe(18)
    expect(vm.durationMs).toBe(18 * 40 * 60_000)
    expect(vm.avgMinutes).toBe(40)
    expect(vm.sessionDelta).toBeNull()
    expect(vm.durationDeltaMs).toBeNull()
  })

  it("builds Rhythm as year hits, not 52 weeks", () => {
    expect(buildRhythmVmFromRollups(career)).toEqual({
      categories: ["2024", "2026"],
      hits: [13, 5],
    })
  })

  it("builds Tonnage year bars with a null delta", () => {
    const vm = buildTonnageVmFromRollups(career)
    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.tonnes).toBe(6)
    expect(vm.deltaTonnes).toBeNull()
    expect(vm.categories).toEqual(["2024", "2026"])
    expect(vm.bars).toEqual([4, 2])
  })

  it("builds Records year grain with null deltas and a RIR line when two years declare", () => {
    const vm = buildRecordsVmFromRollups(career, "2026-08-21")
    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.prs).toBe(11)
    expect(vm.exercises).toBe(7)
    expect(vm.daysSinceLast).toBe(2)
    expect(vm.prsDelta).toBeNull()
    expect(vm.exercisesDelta).toBeNull()
    expect(vm.daysSinceLastDelta).toBeNull()
    expect(vm.categories).toEqual(["2024", "2026"])
    expect(vm.series.prs).toEqual([8, 3])
    expect(vm.series.rir0).toEqual([10, 10])
  })

  it("maps career Regulars from the skinny rollup list", () => {
    expect(regularsFromRollups(career, { squat: "Squat" })).toEqual([
      { name: "Squat", reps: 1240 },
    ])
  })
})
