import { describe, expect, it } from "vitest"
import { buildBalanceVm } from "./balance"
import { computeBalanceScore, MUSCLE_TAXONOMY } from "@/lib/trainingBalance"
import type { VolumeByMuscleResult } from "@/lib/volumeByMuscleGroup"

function volume(
  sessions: number,
  pecs: number,
  extras: Partial<Record<(typeof MUSCLE_TAXONOMY)[number], number>> = {},
): VolumeByMuscleResult {
  return {
    finished_sessions: sessions,
    muscles: MUSCLE_TAXONOMY.map((muscle) => ({
      muscle_group: muscle,
      total_sets: muscle === "Pectoraux" ? pecs : (extras[muscle] ?? 0),
      total_volume_kg: muscle === "Pectoraux" ? pecs * 100 : 0,
      exercise_count: pecs > 0 || (extras[muscle] ?? 0) > 0 ? 1 : 0,
    })),
  }
}

describe("buildBalanceVm", () => {
  it("stays empty below 3 sessions even when sets and radar kg exist", () => {
    const vm = buildBalanceVm(volume(2, 12), volume(2, 8), true)

    expect(vm).toEqual({ status: "empty" })
  })

  it("scores credited sets at 3 sessions and ignores radar kg", () => {
    const current = volume(3, 12, { Dos: 6 })
    const previous = volume(3, 4, { Dos: 4 })
    const vm = buildBalanceVm(current, previous, true)

    expect(vm.status).toBe("ok")
    if (vm.status !== "ok") return
    expect(vm.score).toBe(
      computeBalanceScore(
        MUSCLE_TAXONOMY.map((muscle) =>
          muscle === "Pectoraux" ? 12 : muscle === "Dos" ? 6 : 0,
        ),
      ),
    )
    expect(vm.current.Pectoraux).toBe(12)
    expect(vm.current.Dos).toBe(6)
    expect(vm.scoreDelta).toBe(
      vm.score -
        computeBalanceScore(
          MUSCLE_TAXONOMY.map((muscle) =>
            muscle === "Pectoraux" ? 4 : muscle === "Dos" ? 4 : 0,
          ),
        ),
    )

    const always = buildBalanceVm(current, previous, false)
    expect(always.status).toBe("ok")
    if (always.status !== "ok") return
    expect(always.scoreDelta).toBeNull()
    expect(always.prior).toBeUndefined()
  })
})
