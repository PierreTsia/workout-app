import { describe, expect, it } from "vitest"
import { bodyMapFromIntent } from "./bodyMapFromIntent"
import type {
  IntentCircuit,
  IntentSolo,
  ProgramIntent,
  ProgramIntentDay,
} from "./types"

function makeSolo(overrides: Partial<IntentSolo> = {}): IntentSolo {
  return {
    sets: 10,
    restSeconds: 90,
    repMax: 10,
    measurementType: "reps",
    primaryMuscle: "Pectoraux",
    secondaryMuscles: ["Triceps"],
    equipment: "barbell",
    ...overrides,
  }
}

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

function makeIntent(days: ProgramIntentDay[]): ProgramIntent {
  return { programId: "prog-1", days }
}

function slugs(intent: ProgramIntent) {
  return bodyMapFromIntent(intent).flatMap((row) => row.muscles)
}

describe("bodyMapFromIntent", () => {
  it("returns nothing for an empty week", () => {
    expect(bodyMapFromIntent({ programId: "prog-1", days: [] })).toEqual([])
  })

  it("lights primary and secondary slugs from solo sets", () => {
    const data = slugs(
      makeIntent([makeDay({ solos: [makeSolo()] })]),
    )

    expect(data).toContain("chest")
    expect(data).toContain("triceps")
  })

  it("credits a Circuit station once — never rounds ×", () => {
    const tours: IntentCircuit = {
      mode: "rounds",
      capSeconds: null,
      stations: [
        {
          primaryMuscle: "Dos",
          secondaryMuscles: [],
          equipment: "bodyweight",
        },
      ],
    }

    const data = bodyMapFromIntent(
      makeIntent([makeDay({ id: "tours", circuits: [tours] })]),
    )

    expect(data.map((row) => row.muscles).flat()).toContain("upper-back")
    expect(data.every((row) => (row.frequency ?? 0) <= 7)).toBe(true)
  })
})
