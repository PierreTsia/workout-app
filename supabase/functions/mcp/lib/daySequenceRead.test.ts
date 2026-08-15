import { describe, expect, it } from "vitest"
import {
  dbBlockToCircuitWire,
  daySequenceToEchoExercises,
  mergeDaySequence,
  type DbBlockForRead,
  type DbSoloForRead,
} from "./daySequenceRead"
import { parseExerciseInput } from "./createProgramValidation"

const ID_A = "11111111-2222-4333-8444-555555555555"
const ID_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

function makeBlock(overrides: Partial<DbBlockForRead> = {}): DbBlockForRead {
  return {
    id: "block-1",
    label: "Finisher",
    rounds: 3,
    rest_seconds: 90,
    transition_seconds: 0,
    sort_order: 1,
    block_exercises: [
      {
        exercise_id: ID_A,
        name_snapshot: "Push-up",
        position: 0,
        per_round: [
          { amount: 10, weight: 0 },
          { amount: 10, weight: 0 },
          { amount: 10, weight: 0 },
        ],
        exercises: { name: "Push-up", name_en: "Push-up" },
      },
      {
        exercise_id: ID_B,
        name_snapshot: "Bench Press",
        position: 1,
        per_round: [
          { amount: 8, weight: 60 },
          { amount: 8, weight: 60 },
          { amount: 8, weight: 60 },
        ],
        exercises: { name: "Bench Press", name_en: "Bench Press" },
      },
    ],
    ...overrides,
  }
}

describe("dbBlockToCircuitWire (T165)", () => {
  it("emits flat amount/weight_kg when every per_round cell is homogeneous", () => {
    const wire = dbBlockToCircuitWire(makeBlock())

    expect(wire).toEqual({
      type: "circuit",
      label: "Finisher",
      rounds: 3,
      rest_seconds: 90,
      transition_seconds: 0,
      exercises: [
        { exercise_id: ID_A, amount: 10, weight_kg: 0 },
        { exercise_id: ID_B, amount: 8, weight_kg: 60 },
      ],
    })
  })

  it("emits per_round when nested cells differ across rounds (pyramid)", () => {
    const wire = dbBlockToCircuitWire(
      makeBlock({
        label: null,
        block_exercises: [
          {
            exercise_id: ID_A,
            name_snapshot: "Push-up",
            position: 0,
            per_round: [
              { amount: 20, weight: 0 },
              { amount: 15, weight: 0 },
              { amount: 10, weight: 0 },
            ],
            exercises: { name: "Push-up", name_en: "Push-up" },
          },
          {
            exercise_id: ID_B,
            name_snapshot: "Bench Press",
            position: 1,
            per_round: [
              { amount: 8, weight: 60 },
              { amount: 8, weight: 60 },
              { amount: 8, weight: 60 },
            ],
            exercises: { name: "Bench Press", name_en: "Bench Press" },
          },
        ],
      }),
    )

    expect(wire.label).toBeUndefined()
    expect(wire.exercises[0]).toEqual({
      exercise_id: ID_A,
      per_round: [
        { amount: 20, weight_kg: 0 },
        { amount: 15, weight_kg: 0 },
        { amount: 10, weight_kg: 0 },
      ],
    })
    expect(wire.exercises[1]).toEqual({
      exercise_id: ID_B,
      amount: 8,
      weight_kg: 60,
    })
  })

  it("echoes AMRAP as mode + cap_minutes without Tours fields (echo-ready)", () => {
    const wire = dbBlockToCircuitWire(
      makeBlock({
        label: "Cindy",
        mode: "amrap",
        cap_seconds: 1200,
        rounds: 1,
        rest_seconds: 0,
        transition_seconds: 0,
        block_exercises: [
          {
            exercise_id: ID_A,
            name_snapshot: "Pull-up",
            position: 0,
            per_round: [{ amount: 5, weight: 0 }],
            exercises: { name: "Pull-up", name_en: "Pull-up" },
          },
          {
            exercise_id: ID_B,
            name_snapshot: "Push-up",
            position: 1,
            per_round: [{ amount: 10, weight: 0 }],
            exercises: { name: "Push-up", name_en: "Push-up" },
          },
        ],
      }),
    )

    expect(wire).toEqual({
      type: "circuit",
      label: "Cindy",
      mode: "amrap",
      cap_minutes: 20,
      exercises: [
        { exercise_id: ID_A, amount: 5, weight_kg: 0 },
        { exercise_id: ID_B, amount: 10, weight_kg: 0 },
      ],
    })
    expect(wire).not.toHaveProperty("rounds")
    expect(wire).not.toHaveProperty("rest_seconds")
    expect(wire).not.toHaveProperty("transition_seconds")
  })
})

describe("mergeDaySequence (T165)", () => {
  it("interleaves solos and Circuits by shared sort_order", () => {
    const solos: DbSoloForRead[] = [
      {
        exercise_id: ID_A,
        name_snapshot: "A",
        sets: 3,
        reps: "10",
        weight: "0",
        rest_seconds: 90,
        target_duration_seconds: null,
        sort_order: 0,
      },
      {
        exercise_id: ID_B,
        name_snapshot: "B",
        sets: 3,
        reps: "8",
        weight: "40",
        rest_seconds: 90,
        target_duration_seconds: null,
        sort_order: 2,
      },
    ]
    const blocks = [makeBlock({ sort_order: 1 })]

    const items = mergeDaySequence(solos, blocks)

    expect(items.map((i) => i.kind)).toEqual(["solo", "circuit", "solo"])
    expect(items.map((i) => i.sort_order)).toEqual([0, 1, 2])
  })
})

describe("daySequenceToEchoExercises (T165)", () => {
  it("produces Circuit wire that parseExercise accepts without drift", () => {
    const items = mergeDaySequence([], [makeBlock()])
    const echo = daySequenceToEchoExercises(items)
    const circuitWire = echo[0]
    const parsed = parseExerciseInput(circuitWire, "days[0].exercises[0]")
    expect(parsed.ok).toBe(true)
    if (!parsed.ok || parsed.value.kind !== "circuit") {
      throw new Error("expected circuit parse")
    }
    expect(parsed.value.label).toBe("Finisher")
    expect(parsed.value.rounds).toBe(3)
    expect(parsed.value.exercises).toHaveLength(2)
    expect(parsed.value.exercises[0]).toMatchObject({
      mode: "flat",
      exerciseId: ID_A,
      amount: 10,
      weightKg: 0,
    })
  })

  it("round-trips an AMRAP echo wire through parseExerciseInput", () => {
    const items = mergeDaySequence(
      [],
      [
        makeBlock({
          label: "Cindy",
          mode: "amrap",
          cap_seconds: 1200,
          rounds: 1,
          rest_seconds: 0,
          transition_seconds: 0,
          block_exercises: [
            {
              exercise_id: ID_A,
              name_snapshot: "Pull-up",
              position: 0,
              per_round: [{ amount: 5, weight: 0 }],
              exercises: { name: "Pull-up", name_en: "Pull-up" },
            },
            {
              exercise_id: ID_B,
              name_snapshot: "Push-up",
              position: 1,
              per_round: [{ amount: 10, weight: 0 }],
              exercises: { name: "Push-up", name_en: "Push-up" },
            },
          ],
        }),
      ],
    )
    const echo = daySequenceToEchoExercises(items)
    const parsed = parseExerciseInput(echo[0], "Cindy", 0)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok || parsed.value.kind !== "circuit") {
      throw new Error("expected circuit parse")
    }
    expect(parsed.value.mode).toBe("amrap")
    expect(parsed.value.capMinutes).toBe(20)
    expect(parsed.value.rounds).toBe(1)
  })
})
