import { describe, expect, it } from "vitest"

import { buildPatchProgram } from "./programPatchCard"
import type { CatalogExerciseForProgram } from "./programPersistence"
import type {
  CurrentProgramSnapshot,
  DiffDayInsert,
  DiffDayUpdate,
  ProgramDiff,
} from "./updateProgramTypes"

const ID_DAY_A = "11111111-1111-1111-1111-111111111111"
const ID_DAY_B = "22222222-2222-2222-2222-222222222222"
const ID_BENCH = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const ID_SQUAT = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const ID_PLANK = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"

const catalog = new Map<string, CatalogExerciseForProgram>([
  [ID_BENCH, { id: ID_BENCH, name: "Bench Press", muscle_group: "chest", emoji: "💪", equipment: "barbell" }],
  [ID_SQUAT, { id: ID_SQUAT, name: "Squat", muscle_group: "legs", emoji: "🦵", equipment: "barbell" }],
  [
    ID_PLANK,
    {
      id: ID_PLANK,
      name: "Planche",
      muscle_group: "core",
      emoji: null,
      equipment: "bodyweight",
      measurement_type: "duration",
      default_duration_seconds: 45,
    },
  ],
])

function makeCurrent(): CurrentProgramSnapshot {
  return {
    id: "prog-1",
    name: "Upper",
    days: [
      {
        id: ID_DAY_A,
        label: "Push",
        emoji: "💪",
        sort_order: 0,
        workout_exercises: [
          {
            exercise_id: ID_BENCH,
            name_snapshot: "Bench Press",
            sets: 4,
            reps: "8",
            weight: "80",
            rest_seconds: 120,
            target_duration_seconds: null,
            sort_order: 0,
          },
        ],
      },
    ],
  }
}

function emptyDiff(over: Partial<ProgramDiff> = {}): ProgramDiff {
  return {
    program_id: "prog-1",
    name_change: null,
    days_to_insert: [],
    days_to_update: [],
    days_to_delete: [],
    days_unchanged: [],
    apply_order: "default",
    ...over,
  }
}

function updateDay(over: Partial<DiffDayUpdate> = {}): DiffDayUpdate {
  return {
    id: ID_DAY_A,
    current: { label: "Push", emoji: "💪", sort_order: 0 },
    label: "Push",
    emoji: "💪",
    sort_order: 0,
    parsed_exercises: [],
    ...over,
  }
}

describe("buildPatchProgram", () => {
  it("uses the renamed program name when the patch renames it", () => {
    const diff = emptyDiff({ name_change: { from: "Upper", to: "Upper v2" } })
    expect(buildPatchProgram(diff, makeCurrent(), catalog).name).toBe("Upper v2")
  })

  it("keeps the current name when the patch does not rename", () => {
    expect(buildPatchProgram(emptyDiff(), makeCurrent(), catalog).name).toBe("Upper")
  })

  it("flags only the changed fields on a matched solo (exercise grain)", () => {
    const diff = emptyDiff({
      days_to_update: [
        updateDay({
          parsed_exercises: [
            { kind: "object", exerciseId: ID_BENCH, sets: 5, reps: "8", weightKg: 80, restSeconds: 120, targetDurationSeconds: null },
          ],
        }),
      ],
    })
    const day = buildPatchProgram(diff, makeCurrent(), catalog).days[0]
    expect(day.exercises[0]).toMatchObject({ kind: "solo", change: ["sets"], isNew: false })
  })

  it("normalizes weight strings and rep ranges before comparing (no false change)", () => {
    const diff = emptyDiff({
      days_to_update: [
        updateDay({
          parsed_exercises: [
            { kind: "object", exerciseId: ID_BENCH, sets: 4, reps: "8-12", weightKg: 80, restSeconds: 120, targetDurationSeconds: null },
          ],
        }),
      ],
    })
    const current = makeCurrent()
    current.days[0].workout_exercises[0].reps = "8-12"
    const day = buildPatchProgram(diff, current, catalog).days[0]
    expect(day.exercises[0]).toMatchObject({ change: null })
  })

  it("detects a weight change when the numeric value differs", () => {
    const diff = emptyDiff({
      days_to_update: [
        updateDay({
          parsed_exercises: [
            { kind: "object", exerciseId: ID_BENCH, sets: 4, reps: "8", weightKg: 85, restSeconds: 120, targetDurationSeconds: null },
          ],
        }),
      ],
    })
    const day = buildPatchProgram(diff, makeCurrent(), catalog).days[0]
    expect(day.exercises[0]).toMatchObject({ change: ["weight"] })
  })

  it("never annotates a bare exercise (no explicit prescription)", () => {
    const diff = emptyDiff({
      days_to_update: [updateDay({ parsed_exercises: [{ kind: "bare", exerciseId: ID_BENCH }] })],
    })
    const day = buildPatchProgram(diff, makeCurrent(), catalog).days[0]
    expect(day.exercises[0]).toMatchObject({ kind: "solo", change: null, isNew: false })
  })

  it("bootstraps a bare duration exercise from the catalog hold, not a reps default", () => {
    const diff = emptyDiff({
      days_to_insert: [
        {
          label: "Core",
          emoji: "🔥",
          sort_order: 0,
          parsed_exercises: [{ kind: "bare", exerciseId: ID_PLANK }],
        },
      ],
    })
    const day = buildPatchProgram(diff, makeCurrent(), catalog).days[0]
    expect(day.exercises[0]).toMatchObject({ kind: "solo", sets: 3, targetDurationSeconds: 45 })
  })

  it("marks every exercise of an inserted day as new", () => {
    const insert: DiffDayInsert = {
      label: "Legs",
      emoji: "🦵",
      sort_order: 1,
      parsed_exercises: [
        { kind: "object", exerciseId: ID_SQUAT, sets: 5, reps: "5", weightKg: 100, restSeconds: 180, targetDurationSeconds: null },
      ],
    }
    const day = buildPatchProgram(emptyDiff({ days_to_insert: [insert] }), makeCurrent(), catalog).days[0]
    expect(day.exercises[0]).toMatchObject({ isNew: true, change: null, name: "Squat" })
  })

  it("marks a newly added solo of an updated day as new", () => {
    const diff = emptyDiff({
      days_to_update: [
        updateDay({
          parsed_exercises: [
            { kind: "object", exerciseId: ID_BENCH, sets: 4, reps: "8", weightKg: 80, restSeconds: 120, targetDurationSeconds: null },
            { kind: "object", exerciseId: ID_SQUAT, sets: 3, reps: "10", weightKg: 60, restSeconds: 90, targetDurationSeconds: null },
          ],
        }),
      ],
    })
    const day = buildPatchProgram(diff, makeCurrent(), catalog).days[0]
    expect(day.exercises[1]).toMatchObject({ isNew: true, change: null })
  })

  it("renders an unchanged day from the snapshot with no annotations", () => {
    const current = makeCurrent()
    const diff = emptyDiff({ days_unchanged: [{ id: ID_DAY_A, label: "Push" }] })
    const day = buildPatchProgram(diff, current, catalog).days[0]
    expect(day.exercises[0]).toMatchObject({ kind: "solo", change: null, isNew: false, sets: 4, reps: "8" })
  })

  it("never emits a deleted day", () => {
    const diff = emptyDiff({
      days_to_delete: [{ id: ID_DAY_B, label: "Pull", session_count: 0, blocking: false }],
    })
    expect(buildPatchProgram(diff, makeCurrent(), catalog).days).toHaveLength(0)
  })

  it("orders final days by sort_order, mirroring rendered", () => {
    const insert: DiffDayInsert = {
      label: "Legs",
      emoji: "🦵",
      sort_order: 0,
      parsed_exercises: [{ kind: "bare", exerciseId: ID_SQUAT }],
    }
    const diff = emptyDiff({
      days_to_insert: [insert],
      days_to_update: [updateDay({ sort_order: 1 })],
    })
    const days = buildPatchProgram(diff, makeCurrent(), catalog).days
    expect(days.map((d) => d.label)).toEqual(["Legs", "Push"])
  })

  it("renders a Circuit as a compact line", () => {
    const diff = emptyDiff({
      days_to_insert: [
        {
          label: "WOD",
          emoji: "🔥",
          sort_order: 0,
          parsed_exercises: [
            {
              kind: "circuit",
              label: "Cindy",
              rounds: 3,
              restSeconds: 90,
              transitionSeconds: 0,
              mode: "amrap",
              capMinutes: 20,
              exercises: [
                { mode: "flat", exerciseId: ID_BENCH, amount: 10, weightKg: 0 },
                { mode: "flat", exerciseId: ID_SQUAT, amount: 15, weightKg: 0 },
              ],
            },
          ],
        },
      ],
    })
    const day = buildPatchProgram(diff, makeCurrent(), catalog).days[0]
    expect(day.exercises[0]).toMatchObject({
      kind: "circuit",
      label: "Cindy",
      mode: "amrap",
      capSeconds: 1200,
      exerciseCount: 2,
      isNew: true,
    })
  })
})
