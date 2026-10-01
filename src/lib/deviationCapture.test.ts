import { describe, expect, it } from "vitest"
import {
  buildLoadDeviationPayload,
  isLoadDeviation,
} from "@/lib/deviationCapture"

type Row = { reps: string; weight: string }
type Prescription = { reps: number; weight: number }

function makeRow(overrides: Partial<Row> = {}): Row {
  return { reps: "8", weight: "80", ...overrides }
}

function makePrescription(
  overrides: Partial<Prescription> = {},
): Prescription {
  return { reps: 8, weight: 80, ...overrides }
}

describe("isLoadDeviation", () => {
  it("is false when the logged set matches the prescription", () => {
    expect(isLoadDeviation(makeRow(), makePrescription())).toBe(false)
  })

  it("is true when the logged weight differs from the prescription", () => {
    expect(
      isLoadDeviation(makeRow({ weight: "72.5" }), makePrescription()),
    ).toBe(true)
  })

  it("is true when the logged reps differ from the prescription", () => {
    expect(isLoadDeviation(makeRow({ reps: "6" }), makePrescription())).toBe(
      true,
    )
  })
})

describe("buildLoadDeviationPayload", () => {
  const base = {
    sessionId: "s1",
    workoutExerciseId: "we1",
    exerciseId: "ex1",
    setNumber: 2,
  }

  it("tags the event as a load deviation and keeps the reason", () => {
    const payload = buildLoadDeviationPayload({
      ...base,
      reasonCode: "fatigue",
      note: null,
    })
    expect(payload).toMatchObject({
      ...base,
      kind: "load_deviation",
      reasonCode: "fatigue",
    })
  })

  it("keeps a null reason — the skip is data", () => {
    const payload = buildLoadDeviationPayload({
      ...base,
      reasonCode: null,
      note: null,
    })
    expect(payload.reasonCode).toBeNull()
  })

  it("trims the note and collapses a blank note to null", () => {
    expect(
      buildLoadDeviationPayload({ ...base, reasonCode: null, note: "  hi  " })
        .note,
    ).toBe("hi")
    expect(
      buildLoadDeviationPayload({ ...base, reasonCode: null, note: "   " })
        .note,
    ).toBeNull()
  })
})
