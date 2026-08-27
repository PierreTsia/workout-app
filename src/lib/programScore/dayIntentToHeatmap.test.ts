import { describe, expect, it } from "vitest"
import { dayIntentToHeatmap } from "./dayIntentToHeatmap"
import type {
  IntentCircuit,
  IntentSolo,
  ProgramIntentDay,
} from "./types"

function makeDay(overrides: Partial<ProgramIntentDay> = {}): ProgramIntentDay {
  return {
    id: "day-1",
    label: "Push",
    sortOrder: 0,
    solos: [],
    circuits: [],
    ...overrides,
  }
}

function makeSolo(overrides: Partial<IntentSolo> = {}): IntentSolo {
  return {
    sets: 4,
    restSeconds: 90,
    repMax: 10,
    measurementType: "reps",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps"],
    equipment: "barbell",
    ...overrides,
  }
}

function cindyCircuit(): IntentCircuit {
  return {
    mode: "amrap",
    capSeconds: 20 * 60,
    stations: [
      {
        primaryMuscle: "Dos",
        secondaryMuscles: ["Biceps"],
        equipment: "bodyweight",
      },
      {
        primaryMuscle: "Pectoraux",
        secondaryMuscles: ["Triceps", "Épaules"],
        equipment: "bodyweight",
      },
      {
        primaryMuscle: "Quadriceps",
        secondaryMuscles: ["Fessiers"],
        equipment: "bodyweight",
      },
    ],
  }
}

function chipCredit(
  chips: readonly { muscle: string; credit: number }[],
  muscle: string,
): number | undefined {
  return chips.find((chip) => chip.muscle === muscle)?.credit
}

describe("dayIntentToHeatmap", () => {
  it("credits a Cindy-only day as station presence once — never rounds ×", () => {
    const { data, chips } = dayIntentToHeatmap(
      makeDay({
        id: "cindy",
        label: "Cindy",
        circuits: [cindyCircuit()],
      }),
    )

    expect(chipCredit(chips, "Pectoraux")).toBe(1)
    expect(chipCredit(chips, "Triceps")).toBe(0.5)
    expect(chipCredit(chips, "Pectoraux")).not.toBe(20)
    expect(data.flatMap((row) => row.muscles)).toContain("chest")
  })

  it("returns empty data and chips for an empty day", () => {
    const { data, chips } = dayIntentToHeatmap(makeDay())

    expect(data).toEqual([])
    expect(chips).toEqual([])
  })

  it("credits a PPL push day from solo sets, primary 1 and secondary 0.5", () => {
    const { data, chips } = dayIntentToHeatmap(
      makeDay({
        label: "Push A",
        solos: [
          makeSolo({
            sets: 4,
            primaryMuscle: "Pectoraux",
            secondaryMuscles: ["Triceps"],
          }),
          makeSolo({
            sets: 3,
            primaryMuscle: "Épaules",
            secondaryMuscles: ["Triceps"],
          }),
          makeSolo({
            sets: 3,
            primaryMuscle: "Épaules",
            secondaryMuscles: [],
          }),
          makeSolo({
            sets: 3,
            primaryMuscle: "Triceps",
            secondaryMuscles: [],
          }),
        ],
      }),
    )

    expect(chipCredit(chips, "Triceps")).toBe(6.5)
    expect(chipCredit(chips, "Épaules")).toBe(6)
    expect(chipCredit(chips, "Pectoraux")).toBe(4)
    expect(chips[0]?.muscle).toBe("Triceps")
    expect(data.flatMap((row) => row.muscles)).toEqual(
      expect.arrayContaining(["chest", "front-deltoids", "triceps"]),
    )
  })
})
