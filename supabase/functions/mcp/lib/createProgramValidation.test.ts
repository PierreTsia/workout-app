import { describe, expect, it } from "vitest"
import {
  detectLegacyExerciseIds,
  LEGACY_MIGRATION_ERROR_MESSAGE,
  parseExerciseInput,
  validateDayExercises,
  validateExerciseCrossFields,
  validateRepsModeCrossField,
} from "./createProgramValidation"
import type { CatalogExerciseForProgram } from "./programPersistence"
import type { BenchmarkCircuitLookup } from "./resolveBenchmark"

const VALID_UUID = "11111111-2222-4333-8444-555555555555"
const VALID_UUID_2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const CINDY_PULL = "cccccccc-1111-4111-8111-cccccccccccc"
const CINDY_PUSH = "cccccccc-2222-4222-8222-cccccccccccc"
const CINDY_SQUAT = "cccccccc-3333-4333-8333-cccccccccccc"
const CINDY_SEED: BenchmarkCircuitLookup = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  slug: "cindy",
  aliases: ["holland", "tom holland"],
  rx: {
    mode: "amrap",
    cap_seconds: 1200,
    exercises: [
      { exercise_id: CINDY_PULL, amount: 5, weight: 0 },
      { exercise_id: CINDY_PUSH, amount: 10, weight: 0 },
      { exercise_id: CINDY_SQUAT, amount: 15, weight: 0 },
    ],
  },
}
const DAY = "Push"

describe("detectLegacyExerciseIds", () => {
  it("returns true when at least one day has the v0.2.x exercise_ids field", () => {
    const args = {
      name: "Push 5d",
      days: [{ label: "Push", exercise_ids: [VALID_UUID] }],
    }
    expect(detectLegacyExerciseIds(args)).toBe(true)
  })

  it("returns true even if only ONE of multiple days uses exercise_ids (mixed legacy/new)", () => {
    const args = {
      name: "Push 5d",
      days: [
        { label: "Push", exercises: [VALID_UUID] },
        { label: "Pull", exercise_ids: [VALID_UUID] },
      ],
    }
    expect(detectLegacyExerciseIds(args)).toBe(true)
  })

  it("returns false on the new v0.3.0 shape (exercises only)", () => {
    const args = {
      name: "Push 5d",
      days: [{ label: "Push", exercises: [VALID_UUID] }],
    }
    expect(detectLegacyExerciseIds(args)).toBe(false)
  })

  it("returns false when days is missing or not an array (defensive — error surfaces upstream)", () => {
    expect(detectLegacyExerciseIds({})).toBe(false)
    expect(detectLegacyExerciseIds({ days: "not-an-array" })).toBe(false)
  })
})

describe("LEGACY_MIGRATION_ERROR_MESSAGE", () => {
  it("contains the version string '0.3.0' so agents know which release introduced the break", () => {
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain("0.3.0")
  })

  it("shows the new bare-string shape as one of the migration paths", () => {
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain('"exercises": ["uuid-1", "uuid-2"]')
  })

  it("shows the new object form with the required prescription fields", () => {
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain('"sets": 4')
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain('"reps": "8"')
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain('"weight_kg": 80')
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain('"rest_seconds": 120')
  })

  it("points the agent at get_exercise_details for weight_convention guidance", () => {
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain("get_exercise_details")
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain("weight_convention")
  })
})

describe("parseExerciseInput — bare string form", () => {
  it("accepts a valid UUID and returns kind: 'bare'", () => {
    const result = parseExerciseInput(VALID_UUID, DAY, 0)
    expect(result).toEqual({
      ok: true,
      value: { kind: "bare", exerciseId: VALID_UUID },
    })
  })

  it("rejects a non-UUID string with a positional error", () => {
    const result = parseExerciseInput("not-a-uuid", DAY, 0)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('days["Push"].exercises[0]')
      expect(result.error).toContain("not-a-uuid")
    }
  })
})

describe("parseExerciseInput — object form (happy path)", () => {
  it("accepts a complete prescription with required fields and no target_duration_seconds", () => {
    const input = {
      exercise_id: VALID_UUID,
      sets: 4,
      reps: "8",
      weight_kg: 80,
      rest_seconds: 120,
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "object",
        exerciseId: VALID_UUID,
        sets: 4,
        reps: "8",
        weightKg: 80,
        restSeconds: 120,
        targetDurationSeconds: null,
      },
    })
  })

  it("accepts a 'N-M' reps range (double progression)", () => {
    const input = {
      exercise_id: VALID_UUID,
      sets: 4,
      reps: "8-12",
      weight_kg: 80,
      rest_seconds: 120,
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({ reps: "8-12" })
    }
  })

  it("accepts an explicit target_duration_seconds — shape/bounds only; cross-field gating is layer 2", () => {
    // The reps="8" + target_duration_seconds combo will be REJECTED by
    // validateRepsModeCrossField on a reps exercise (T74's only cross-field
    // rule). The bounds layer just confirms it parses and lands in the bounds
    // window. T75 adds the symmetric duration-mode cross-field rules.
    const input = {
      exercise_id: VALID_UUID,
      sets: 4,
      reps: "8",
      weight_kg: 80,
      rest_seconds: 120,
      target_duration_seconds: 45,
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({ targetDurationSeconds: 45 })
    }
  })

  it("accepts target_duration_seconds === null as the same as omitted", () => {
    const input = {
      exercise_id: VALID_UUID,
      sets: 4,
      reps: "8",
      weight_kg: 80,
      rest_seconds: 120,
      target_duration_seconds: null,
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({ targetDurationSeconds: null })
    }
  })

  it("accepts fractional weight_kg (DB column is TEXT, fractional kgs are valid)", () => {
    const input = {
      exercise_id: VALID_UUID,
      sets: 3,
      reps: "10",
      weight_kg: 22.5,
      rest_seconds: 60,
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({ weightKg: 22.5 })
    }
  })
})

describe("parseExerciseInput — bounds and shape rejections", () => {
  function expectError(input: unknown, fragment: string) {
    const result = parseExerciseInput(input, DAY, 2)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('days["Push"].exercises[2]')
      expect(result.error).toContain(fragment)
    }
  }

  it("rejects null", () => {
    expectError(null, "must be a UUID string, a prescription object, or a Circuit")
  })

  it("rejects an array", () => {
    expectError([VALID_UUID], "must be a UUID string, a prescription object, or a Circuit")
  })

  it("rejects a number", () => {
    expectError(42, "must be a UUID string, a prescription object, or a Circuit")
  })

  it("rejects an object missing exercise_id", () => {
    expectError({ sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120 }, "exercise_id")
  })

  it("rejects an object with non-UUID exercise_id", () => {
    expectError({ exercise_id: "garbage", sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120 }, "exercise_id")
  })

  it("rejects sets out of bounds (sets > 10)", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 11, reps: "8", weight_kg: 80, rest_seconds: 120 },
      ".sets",
    )
  })

  it("rejects sets out of bounds (sets < 1)", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 0, reps: "8", weight_kg: 80, rest_seconds: 120 },
      ".sets",
    )
  })

  it("rejects non-integer sets (e.g. 4.5)", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4.5, reps: "8", weight_kg: 80, rest_seconds: 120 },
      ".sets",
    )
  })

  it("rejects reps that don't match the regex (e.g. 'AMRAP')", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "AMRAP", weight_kg: 80, rest_seconds: 120 },
      ".reps",
    )
  })

  it("rejects reps with trailing dash (e.g. '8-')", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8-", weight_kg: 80, rest_seconds: 120 },
      ".reps",
    )
  })

  it("rejects reps with inverted range (e.g. '12-8')", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "12-8", weight_kg: 80, rest_seconds: 120 },
      ".reps",
    )
  })

  it("rejects reps bounds out of [0, 50] (e.g. '51' or '50-60')", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "51", weight_kg: 80, rest_seconds: 120 },
      "out of range",
    )
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "10-60", weight_kg: 80, rest_seconds: 120 },
      "out of range",
    )
  })

  it("accepts reps '0' at the bounds layer (sentinel for duration mode; cross-field R6 enforces semantics)", () => {
    const result = parseExerciseInput(
      { exercise_id: VALID_UUID, sets: 3, reps: "0", weight_kg: 0, rest_seconds: 60, target_duration_seconds: 45 },
      "Day 1",
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("rejects weight_kg out of [0, 500]", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8", weight_kg: -5, rest_seconds: 120 },
      ".weight_kg",
    )
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8", weight_kg: 501, rest_seconds: 120 },
      ".weight_kg",
    )
  })

  it("rejects rest_seconds out of [0, 600]", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8", weight_kg: 80, rest_seconds: 601 },
      ".rest_seconds",
    )
  })

  it("rejects target_duration_seconds out of [5, 600]", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120, target_duration_seconds: 4 },
      ".target_duration_seconds",
    )
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120, target_duration_seconds: 601 },
      ".target_duration_seconds",
    )
  })
})

describe("validateExerciseCrossFields (T75 superset; T74 rule R4 still covered)", () => {
  type ObjectOverrides = Partial<{
    targetDurationSeconds: number | null
    weightKg: number
    reps: string
  }>

  function makeObject(overrides: ObjectOverrides = {}) {
    return {
      kind: "object" as const,
      exerciseId: VALID_UUID,
      sets: 4,
      reps: "8",
      weightKg: 80,
      restSeconds: 120,
      targetDurationSeconds: null as number | null,
      ...overrides,
    }
  }

  const REPS_BARBELL = { name: "Bench Press", equipment: "barbell", measurement_type: "reps" as const }
  const REPS_DUMBBELL = { name: "DB Curl", equipment: "dumbbell", measurement_type: "reps" as const }
  const REPS_BODYWEIGHT = { name: "Pushup", equipment: "bodyweight", measurement_type: "reps" as const }
  const DURATION_BODYWEIGHT = { name: "Plank", equipment: "bodyweight", measurement_type: "duration" as const }

  it("passes a bare-string parsed exercise (no fields to cross-check)", () => {
    const result = validateExerciseCrossFields(
      { kind: "bare", exerciseId: VALID_UUID_2 },
      REPS_BARBELL,
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("passes a complete reps prescription on a barbell exercise (happy path)", () => {
    const result = validateExerciseCrossFields(makeObject(), REPS_BARBELL, DAY, 0)
    expect(result.ok).toBe(true)
  })

  it("passes a duration prescription with target_duration_seconds on a duration exercise (happy path)", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 0, targetDurationSeconds: 45 }),
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("R1: REJECTS bodyweight + weight_kg > 0 and references issue #281", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "12", weightKg: 50 }),
      REPS_BODYWEIGHT,
      DAY,
      1,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('days["Push"].exercises[1]')
      expect(result.error).toContain("Pushup")
      expect(result.error).toContain("weight_kg")
      expect(result.error).toContain("#281")
    }
  })

  it("R1: passes bodyweight + weight_kg === 0 (the only legal weight on bodyweight)", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "12", weightKg: 0 }),
      REPS_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("R2: REJECTS duration exercise with non-'0' reps (e.g. reps='8')", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "8", weightKg: 0, targetDurationSeconds: 45 }),
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Plank")
      expect(result.error).toContain('reps "8"')
    }
  })

  it("R3: REJECTS duration exercise with weight_kg > 0", () => {
    // Use a non-bodyweight equipment so R1 doesn't fire first.
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 10, targetDurationSeconds: 45 }),
      { name: "Weighted Hang", equipment: "barbell", measurement_type: "duration" },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Weighted Hang")
      expect(result.error).toContain("weight_kg")
      expect(result.error).toContain("v0.3.0")
    }
  })

  it("R4 (T74): REJECTS reps exercise with target_duration_seconds set (still enforced by the T75 superset)", () => {
    const result = validateExerciseCrossFields(
      makeObject({ targetDurationSeconds: 30 }),
      REPS_DUMBBELL,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("DB Curl")
      expect(result.error).toContain("target_duration_seconds")
    }
  })

  it("R5: REJECTS duration exercise object form WITHOUT target_duration_seconds and points at the bare-UUID escape hatch", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 0, targetDurationSeconds: null }),
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Plank")
      expect(result.error).toContain("requires target_duration_seconds")
      expect(result.error).toContain("bare UUID")
    }
  })

  it("R5: passes a duration exercise as a bare UUID even though no target_duration_seconds is set", () => {
    const result = validateExerciseCrossFields(
      { kind: "bare", exerciseId: VALID_UUID },
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("R6: REJECTS a non-duration (reps) exercise that passes reps \"0\" — sentinel reserved for duration mode", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 80, targetDurationSeconds: null }),
      REPS_BARBELL,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Bench Press")
      expect(result.error).toContain('reps "0"')
      expect(result.error).toContain("reserved for duration")
    }
  })

  it("R6: REJECTS reps \"0\" even on a bodyweight reps exercise (no equipment exemption)", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 0, targetDurationSeconds: null }),
      REPS_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Pushup")
      expect(result.error).toContain('reps "0"')
    }
  })

  it("R6: ACCEPTS reps \"0\" on a duration exercise (the supported pairing with target_duration_seconds)", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 0, targetDurationSeconds: 45 }),
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("rule order: R1 fires BEFORE R3 (bodyweight error wins over duration error)", () => {
    // Bodyweight + duration + weight > 0 → both R1 and R3 would match, but R1
    // is more specific and points at #281; R3 is the generic duration message.
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 50, targetDurationSeconds: 45 }),
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("#281")
    }
  })
})

describe("validateRepsModeCrossField (deprecated T74 shim — backwards compatibility)", () => {
  it("forwards to validateExerciseCrossFields and still rejects R4 violations", () => {
    const result = validateRepsModeCrossField(
      {
        kind: "object",
        exerciseId: VALID_UUID,
        sets: 4,
        reps: "8",
        weightKg: 80,
        restSeconds: 120,
        targetDurationSeconds: 30,
      },
      { name: "Bench Press", measurement_type: "reps" },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Bench Press")
      expect(result.error).toContain("target_duration_seconds")
    }
  })
})

describe("validateDayExercises (T77)", () => {
  const ID_BENCH = "11111111-1111-4111-8111-111111111111"
  const ID_PUSHUP = "22222222-2222-4222-8222-222222222222"
  const ID_PLANK = "33333333-3333-4333-8333-333333333333"
  const ID_OFF = "99999999-9999-4999-8999-999999999999"

  const BENCH: CatalogExerciseForProgram = {
    id: ID_BENCH,
    name: "Bench Press",
    muscle_group: "chest",
    emoji: null,
    equipment: "barbell",
    measurement_type: "reps",
    default_duration_seconds: null,
  }

  const PUSHUP: CatalogExerciseForProgram = {
    id: ID_PUSHUP,
    name: "Push-up",
    muscle_group: "chest",
    emoji: null,
    equipment: "bodyweight",
    measurement_type: "reps",
    default_duration_seconds: null,
  }

  const PLANK: CatalogExerciseForProgram = {
    id: ID_PLANK,
    name: "Plank",
    muscle_group: "core",
    emoji: null,
    equipment: "bodyweight",
    measurement_type: "duration",
    default_duration_seconds: 30,
  }

  function catalogOf(...exercises: CatalogExerciseForProgram[]) {
    return new Map(exercises.map((e) => [e.id, e] as const))
  }

  it("returns parsed exercises on a happy mixed-form day (bare UUID + object prescription)", () => {
    const raw = [
      ID_BENCH,
      {
        exercise_id: ID_PUSHUP,
        sets: 4,
        reps: "12",
        weight_kg: 0,
        rest_seconds: 90,
      },
    ]

    const result = validateDayExercises(raw, "Push", catalogOf(BENCH, PUSHUP))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.parsed).toHaveLength(2)
      expect(result.parsed[0]).toEqual({ kind: "bare", exerciseId: ID_BENCH })
      expect(result.parsed[1]).toMatchObject({
        kind: "object",
        exerciseId: ID_PUSHUP,
        sets: 4,
        reps: "12",
        weightKg: 0,
        restSeconds: 90,
      })
    }
  })

  it("returns a parse error with the day-and-position locator when one entry is malformed", () => {
    const raw = [ID_BENCH, "not-a-uuid"]

    const result = validateDayExercises(raw, "Push", catalogOf(BENCH))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('days["Push"].exercises[1]')
      expect(result.error).toContain("not-a-uuid")
    }
  })

  it("returns an error referencing the missing exercise_id when the catalog map lacks an object-form prescription", () => {
    const raw = [
      {
        exercise_id: ID_OFF,
        sets: 4,
        reps: "8",
        weight_kg: 80,
        rest_seconds: 120,
      },
    ]

    const result = validateDayExercises(raw, "Push", catalogOf(BENCH))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('days["Push"].exercises[0]')
      expect(result.error).toContain(ID_OFF)
    }
  })

  it("returns the cross-field error when an object prescription violates a catalog-aware rule (bodyweight + weight_kg > 0)", () => {
    const raw = [
      {
        exercise_id: ID_PUSHUP,
        sets: 4,
        reps: "12",
        weight_kg: 25,
        rest_seconds: 90,
      },
    ]

    const result = validateDayExercises(raw, "Push", catalogOf(PUSHUP))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('days["Push"].exercises[0]')
      expect(result.error).toContain("Push-up")
      expect(result.error).toContain("#281")
    }
  })

  it("does NOT cross-field check bare-string entries (bare UUIDs always pass through to defaults)", () => {
    const raw = [ID_PLANK]

    const result = validateDayExercises(raw, "Core", catalogOf(PLANK))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.parsed).toEqual([{ kind: "bare", exerciseId: ID_PLANK }])
    }
  })
})

describe("parseExerciseInput — circuit form (T163 / ADR 0011)", () => {
  it("accepts a flat MCP Circuit Item with defaults applied for omitted rounds/rest/transition", () => {
    const input = {
      type: "circuit",
      label: "Finisher",
      exercises: [
        { exercise_id: VALID_UUID, amount: 10, weight_kg: 0 },
        { exercise_id: VALID_UUID_2, amount: 12, weight_kg: 16 },
      ],
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "circuit",
        label: "Finisher",
        mode: "rounds",
        capMinutes: null,
        rounds: 3,
        restSeconds: 90,
        transitionSeconds: 0,
        exercises: [
          { mode: "flat", exerciseId: VALID_UUID, amount: 10, weightKg: 0 },
          { mode: "flat", exerciseId: VALID_UUID_2, amount: 12, weightKg: 16 },
        ],
      },
    })
  })

  it("accepts per_round when length matches rounds", () => {
    const input = {
      type: "circuit",
      rounds: 3,
      exercises: [
        {
          exercise_id: VALID_UUID,
          per_round: [
            { amount: 20, weight_kg: 0 },
            { amount: 15, weight_kg: 0 },
            { amount: 10, weight_kg: 0 },
          ],
        },
        { exercise_id: VALID_UUID_2, amount: 30, weight_kg: 0 },
      ],
    }
    const result = parseExerciseInput(input, DAY, 1)
    expect(result.ok).toBe(true)
    if (result.ok && result.value.kind === "circuit") {
      expect(result.value.exercises[0]).toEqual({
        mode: "per_round",
        exerciseId: VALID_UUID,
        perRound: [
          { amount: 20, weightKg: 0 },
          { amount: 15, weightKg: 0 },
          { amount: 10, weightKg: 0 },
        ],
      })
      expect(result.value.exercises[1].mode).toBe("flat")
    }
  })

  it("rejects solo field sets on a Circuit item", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        sets: 3,
        exercises: [
          { exercise_id: VALID_UUID, amount: 10, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('solo field "sets"')
  })

  it("rejects flat amount together with per_round on the same nested exercise", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        rounds: 2,
        exercises: [
          {
            exercise_id: VALID_UUID,
            amount: 10,
            weight_kg: 0,
            per_round: [
              { amount: 10, weight_kg: 0 },
              { amount: 8, weight_kg: 0 },
            ],
          },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("not both")
  })

  it("rejects fewer than 2 nested exercises", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        exercises: [{ exercise_id: VALID_UUID, amount: 10, weight_kg: 0 }],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("between 2 and 8")
  })
})

const ID_PULLUP = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"

describe("parseExerciseInput — AMRAP Circuit (T187 / ADR 0014)", () => {
  it("parses Cindy (mode=amrap, cap_minutes=20, flat nested) as AMRAP with cap 20", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        label: "Cindy",
        mode: "amrap",
        cap_minutes: 20,
        exercises: [
          { exercise_id: VALID_UUID, amount: 5, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
          { exercise_id: ID_PULLUP, amount: 15, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )

    expect(result).toEqual({
      ok: true,
      value: {
        kind: "circuit",
        label: "Cindy",
        mode: "amrap",
        capMinutes: 20,
        rounds: 1,
        restSeconds: 0,
        transitionSeconds: 0,
        exercises: [
          { mode: "flat", exerciseId: VALID_UUID, amount: 5, weightKg: 0 },
          { mode: "flat", exerciseId: VALID_UUID_2, amount: 10, weightKg: 0 },
          { mode: "flat", exerciseId: ID_PULLUP, amount: 15, weightKg: 0 },
        ],
      },
    })
  })

  it("rejects mode=amrap when rounds is also present (no silent drop)", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        mode: "amrap",
        cap_minutes: 20,
        rounds: 3,
        exercises: [
          { exercise_id: VALID_UUID, amount: 5, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("amrap")
      expect(result.error).toContain("rounds")
    }
  })

  it("rejects mode=amrap when rest_seconds is present", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        mode: "amrap",
        rest_seconds: 90,
        exercises: [
          { exercise_id: VALID_UUID, amount: 5, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("rest_seconds")
  })

  it("rejects mode=amrap when transition_seconds is present", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        mode: "amrap",
        transition_seconds: 15,
        exercises: [
          { exercise_id: VALID_UUID, amount: 5, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("transition_seconds")
  })

  it("rejects mode=amrap when a nested exercise uses per_round", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        mode: "amrap",
        cap_minutes: 20,
        exercises: [
          {
            exercise_id: VALID_UUID,
            per_round: [{ amount: 5, weight_kg: 0 }],
          },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("per_round")
  })

  it("rejects cap_minutes on a Tours Circuit (mode omitted or rounds)", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        cap_minutes: 20,
        exercises: [
          { exercise_id: VALID_UUID, amount: 10, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("cap_minutes")
    }
  })

  it("defaults cap_minutes to 20 when mode=amrap omits the cap", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        mode: "amrap",
        exercises: [
          { exercise_id: VALID_UUID, amount: 5, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
    if (result.ok && result.value.kind === "circuit") {
      expect(result.value.mode).toBe("amrap")
      expect(result.value.capMinutes).toBe(20)
    }
  })

  it("rejects an unknown mode instead of dropping it", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        mode: "emom",
        exercises: [
          { exercise_id: VALID_UUID, amount: 10, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("mode")
      expect(result.error).toContain("emom")
    }
  })

  it("rejects cap_minutes outside 1–60", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        mode: "amrap",
        cap_minutes: 90,
        exercises: [
          { exercise_id: VALID_UUID, amount: 5, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 10, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("cap_minutes")
  })
})

describe("parseExerciseInput — Benchmark Circuit slug (T191)", () => {
  it("rejects an unknown benchmark_slug and does not treat the item as a jetable Circuit", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        benchmark_slug: "not-a-wod",
        exercises: [
          { exercise_id: VALID_UUID, amount: 6, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 11, weight_kg: 0 },
        ],
      },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("not-a-wod")
      expect(result.error.toLowerCase()).toMatch(/unknown|not found/)
    }
  })

  it("replaces caller exercises/mode/cap with catalog Rx when benchmark_slug is known", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        benchmark_slug: "cindy",
        mode: "rounds",
        rounds: 4,
        exercises: [
          { exercise_id: VALID_UUID, amount: 6, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 11, weight_kg: 0 },
        ],
      },
      DAY,
      0,
      [CINDY_SEED],
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.kind !== "circuit") {
      throw new Error("expected catalog Circuit")
    }
    expect(result.value.benchmarkCircuitId).toBe(CINDY_SEED.id)
    expect(result.value.benchmarkSlug).toBe("cindy")
    expect(result.value.label).toBe("Cindy")
    expect(result.value.mode).toBe("amrap")
    expect(result.value.capMinutes).toBe(20)
    expect(result.value.rounds).toBe(1)
    expect(result.value.restSeconds).toBe(0)
    expect(result.value.transitionSeconds).toBe(0)
    expect(result.value.exercises).toEqual([
      { mode: "flat", exerciseId: CINDY_PULL, amount: 5, weightKg: 0 },
      { mode: "flat", exerciseId: CINDY_PUSH, amount: 10, weightKg: 0 },
      { mode: "flat", exerciseId: CINDY_SQUAT, amount: 15, weightKg: 0 },
    ])
  })

  it("coerces label Holland (no slug) to the cindy seed Rx and FK", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        label: "Holland",
        exercises: [
          { exercise_id: VALID_UUID, amount: 6, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 11, weight_kg: 0 },
        ],
      },
      DAY,
      0,
      [CINDY_SEED],
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.kind !== "circuit") {
      throw new Error("expected coerced Cindy")
    }
    expect(result.value.benchmarkCircuitId).toBe(CINDY_SEED.id)
    expect(result.value.benchmarkSlug).toBe("cindy")
    expect(result.value.label).toBe("Cindy")
    expect(result.value.exercises.map((ex) => ex.mode === "flat" ? ex.amount : 0)).toEqual([5, 10, 15])
  })

  it("leaves a generic AMRAP jetable (null catalog FK) when the label is not a seed name", () => {
    const result = parseExerciseInput(
      {
        type: "circuit",
        label: "HIIT 20",
        mode: "amrap",
        cap_minutes: 20,
        exercises: [
          { exercise_id: VALID_UUID, amount: 10, weight_kg: 0 },
          { exercise_id: VALID_UUID_2, amount: 12, weight_kg: 0 },
        ],
      },
      DAY,
      0,
      [CINDY_SEED],
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.kind !== "circuit") {
      throw new Error("expected jetable Circuit")
    }
    expect(result.value.benchmarkCircuitId ?? null).toBeNull()
    expect(result.value.benchmarkSlug ?? null).toBeNull()
    expect(result.value.label).toBe("HIIT 20")
    expect(result.value.exercises).toHaveLength(2)
  })
})
