import { afterEach, describe, expect, it, vi } from "vitest"
import {
  formatActiveCycleWarning,
  formatPrescriptionLine,
  formatProgramAfterUpdate,
  formatProgramDetails,
  formatProgramListEntry,
  formatSessionSummary,
  formatWeightConvention,
  type WeightConvention,
} from "./format"
import type { CatalogExerciseForProgram } from "./programPersistence"
import type {
  CurrentProgramSnapshot,
  ProgramDiff,
} from "./updateProgramTypes"

interface ProgramListEntryInput {
  id: string
  name: string
  is_active: boolean
  day_count: number
  created_at: string
  has_active_cycle: boolean
  archived_at: string | null
}

function makeProgramEntry(
  overrides: Partial<ProgramListEntryInput> = {},
): ProgramListEntryInput {
  return {
    id: "a3f0c4e5-1234-5678-9abc-def012345678",
    name: "Mai 2026 v2",
    is_active: true,
    day_count: 6,
    created_at: "2026-05-01T08:00:00.000Z",
    has_active_cycle: true,
    archived_at: null,
    ...overrides,
  }
}

describe("formatProgramListEntry", () => {
  it("renders an active program with an active cycle as '(active, cycle in progress)'", () => {
    const entry = makeProgramEntry({
      name: "Mai 2026 v2",
      id: "a3f0c4e5-1234-5678-9abc-def012345678",
      is_active: true,
      has_active_cycle: true,
      day_count: 6,
      created_at: "2026-05-01T08:00:00.000Z",
    })

    const line = formatProgramListEntry(entry)

    expect(line).toBe(
      "**Mai 2026 v2** *(id: a3f0c4e5-1234-5678-9abc-def012345678)* — 6 days, created 2026-05-01 (active, cycle in progress)",
    )
  })

  it("renders an active program without an active cycle as '(active)'", () => {
    const entry = makeProgramEntry({ is_active: true, has_active_cycle: false })

    const line = formatProgramListEntry(entry)

    expect(line.endsWith(" (active)")).toBe(true)
  })

  it("renders an inactive non-archived program as '(draft)'", () => {
    const entry = makeProgramEntry({
      is_active: false,
      has_active_cycle: false,
      archived_at: null,
    })

    const line = formatProgramListEntry(entry)

    expect(line.endsWith(" (draft)")).toBe(true)
  })

  it("renders an archived program as '(archived)' even when is_active is true", () => {
    const entry = makeProgramEntry({
      is_active: true,
      has_active_cycle: true,
      archived_at: "2026-04-15T10:00:00.000Z",
    })

    const line = formatProgramListEntry(entry)

    expect(line.endsWith(" (archived)")).toBe(true)
  })

  it("renders a program with zero days as '0 days' without crashing or hiding the metric", () => {
    const entry = makeProgramEntry({ day_count: 0 })

    const line = formatProgramListEntry(entry)

    expect(line).toContain("— 0 days, ")
  })
})

interface ProgramDetailsExercise {
  id: string
  exercise_id: string
  name_snapshot: string
  name?: string | null
  name_en?: string | null
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  target_duration_seconds: number | null
}

interface ProgramDetailsDay {
  id: string
  label: string
  emoji: string
  sort_order: number
}

interface ProgramDetailsHeader {
  id: string
  name: string
  archived_at: string | null
}

function makeProgram(overrides: Partial<ProgramDetailsHeader> = {}): ProgramDetailsHeader {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Mai 2026 v2",
    archived_at: null,
    ...overrides,
  }
}

function makeDay(overrides: Partial<ProgramDetailsDay> = {}): ProgramDetailsDay {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    label: "Push",
    emoji: "💪",
    sort_order: 0,
    ...overrides,
  }
}

function makeExercise(overrides: Partial<ProgramDetailsExercise> = {}): ProgramDetailsExercise {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    exercise_id: "ex000033-3333-4333-8333-333333333333",
    name_snapshot: "Bench Press",
    sets: 4,
    reps: "8",
    weight: "80",
    rest_seconds: 120,
    target_duration_seconds: null,
    ...overrides,
  }
}

describe("formatProgramDetails", () => {
  it("renders a single-day program with multiple exercises, surfacing the catalog exercise_id on each exercise line", () => {
    const program = makeProgram()
    const day = makeDay()
    const exercises = [
      makeExercise({
        id: "33333333-3333-4333-8333-333333333333",
        exercise_id: "cccccccc-3333-4333-8333-333333333333",
        name_snapshot: "Bench Press",
        sets: 4,
        reps: "8",
        weight: "80",
        rest_seconds: 120,
      }),
      makeExercise({
        id: "44444444-4444-4444-8444-444444444444",
        exercise_id: "cccccccc-4444-4444-8444-444444444444",
        name_snapshot: "Overhead Press",
        sets: 3,
        reps: "10",
        weight: "40",
        rest_seconds: 90,
      }),
    ]
    const exercisesByDay = new Map([[day.id, exercises]])

    const md = formatProgramDetails(program, [day], exercisesByDay)

    expect(md).toBe(
      "## **Mai 2026 v2** *(id: 11111111-1111-4111-8111-111111111111)*\n\n" +
        "### 💪 Push *(id: 22222222-2222-4222-8222-222222222222)*\n" +
        "  - **Bench Press** *(exercise_id: cccccccc-3333-4333-8333-333333333333)*: 4 × 8 reps @ 80 kg (rest 120s)\n" +
        "  - **Overhead Press** *(exercise_id: cccccccc-4444-4444-8444-444444444444)*: 3 × 10 reps @ 40 kg (rest 90s)",
    )
  })

  it("renders bilingual catalog names when name + name_en are present", () => {
    const program = makeProgram()
    const day = makeDay()
    const exercises = [
      makeExercise({
        name_snapshot: "Développé couché",
        name: "Développé couché",
        name_en: "Bench Press",
        exercise_id: "cccccccc-3333-4333-8333-333333333333",
      }),
    ]
    const md = formatProgramDetails(program, [day], new Map([[day.id, exercises]]))

    expect(md).toContain(
      "**Développé couché** (Bench Press) *(exercise_id: cccccccc-3333-4333-8333-333333333333)*",
    )
    expect(md).not.toContain("()")
  })

  it("falls back to name_snapshot alone when the catalog join is missing", () => {
    const program = makeProgram()
    const day = makeDay()
    const exercises = [makeExercise({ name_snapshot: "Frozen Snapshot", name: null, name_en: null })]
    const md = formatProgramDetails(program, [day], new Map([[day.id, exercises]]))

    expect(md).toContain("**Frozen Snapshot** *(exercise_id:")
    expect(md).not.toContain("()")
  })

  it("renders a multi-day program with different exercise counts per day", () => {
    const program = makeProgram()
    const dayA = makeDay({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", label: "Push", emoji: "💪", sort_order: 0 })
    const dayB = makeDay({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", label: "Pull", emoji: "🪝", sort_order: 1 })
    const exercisesByDay = new Map([
      [dayA.id, [makeExercise({ id: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name_snapshot: "Bench Press" })]],
      [
        dayB.id,
        [
          makeExercise({ id: "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name_snapshot: "Pull-up" }),
          makeExercise({ id: "33333333-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name_snapshot: "Barbell Row" }),
          makeExercise({ id: "44444444-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name_snapshot: "Curl" }),
        ],
      ],
    ])

    const md = formatProgramDetails(program, [dayA, dayB], exercisesByDay)

    expect(md).toContain("### 💪 Push *(id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa)*")
    expect(md).toContain("### 🪝 Pull *(id: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)*")
    expect(md.match(/^ {2}- \*\*/gm)?.length).toBe(4)
  })

  it("renders an empty program (zero days) with an explicit '_(empty program ...)_' line instead of day blocks", () => {
    const program = makeProgram()

    const md = formatProgramDetails(program, [], new Map())

    expect(md).toContain("## **Mai 2026 v2** *(id: 11111111-1111-4111-8111-111111111111)*")
    expect(md).toContain("_(empty program — no days defined)_")
  })

  it("appends '(archived)' to the program header when archived_at is set", () => {
    const program = makeProgram({ archived_at: "2026-04-01T10:00:00.000Z" })
    const day = makeDay()
    const exercisesByDay = new Map([[day.id, [makeExercise()]]])

    const md = formatProgramDetails(program, [day], exercisesByDay)

    expect(md.split("\n")[0]).toBe(
      "## **Mai 2026 v2** *(id: 11111111-1111-4111-8111-111111111111)* (archived)",
    )
  })

  it("omits the ' @ 0 kg' suffix when an exercise has weight '0' (bodyweight, dips, pull-ups...)", () => {
    const program = makeProgram()
    const day = makeDay()
    const exercises = [
      makeExercise({
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        exercise_id: "cccccccc-ffff-4fff-8fff-ffffffffffff",
        name_snapshot: "Pull-up",
        sets: 4,
        reps: "8",
        weight: "0",
        rest_seconds: 90,
      }),
    ]
    const exercisesByDay = new Map([[day.id, exercises]])

    const md = formatProgramDetails(program, [day], exercisesByDay)

    expect(md).toContain("**Pull-up** *(exercise_id: cccccccc-ffff-4fff-8fff-ffffffffffff)*: 4 × 8 reps (rest 90s)")
    expect(md).not.toContain("@ 0 kg")
  })

  it("renders '{sets} × {N}s' when an exercise has target_duration_seconds set instead of reps", () => {
    const program = makeProgram()
    const day = makeDay()
    const exercises = [
      makeExercise({
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        exercise_id: "cccccccc-eeee-4eee-8eee-eeeeeeeeeeee",
        name_snapshot: "Plank",
        sets: 3,
        reps: "0",
        weight: "0",
        rest_seconds: 60,
        target_duration_seconds: 45,
      }),
    ]
    const exercisesByDay = new Map([[day.id, exercises]])

    const md = formatProgramDetails(program, [day], exercisesByDay)

    expect(md).toContain("**Plank** *(exercise_id: cccccccc-eeee-4eee-8eee-eeeeeeeeeeee)*: 3 × 45s (rest 60s)")
    expect(md).not.toContain("reps")
  })
})

interface SessionForFormatInput {
  workout_label_snapshot: string
  started_at: string
  finished_at: string | null
  active_duration_ms: number | null
  total_sets_done: number
}

function makeSession(overrides: Partial<SessionForFormatInput> = {}): SessionForFormatInput {
  return {
    workout_label_snapshot: "Push Day",
    started_at: "2026-04-27T18:00:00.000Z",
    finished_at: "2026-04-27T19:00:00.000Z",
    active_duration_ms: 3_600_000,
    total_sets_done: 12,
    ...overrides,
  }
}

describe("formatSessionSummary — programInfo branch", () => {
  it("annotates the header with '*(program: <name>, id: <uuid>)*' when programInfo is provided", () => {
    const session = makeSession({ workout_label_snapshot: "Push Day" })
    const programInfo = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Mai 2026 v2",
    }

    const md = formatSessionSummary(session, [], programInfo)
    const headerLine = md.split("\n")[0]

    expect(headerLine).toContain("Push Day")
    expect(headerLine).toContain("*(program: Mai 2026 v2, id: 11111111-1111-4111-8111-111111111111)*")
  })

  it("does not annotate the header (regression guard for existing callers) when programInfo is omitted", () => {
    const session = makeSession({ workout_label_snapshot: "Push Day" })

    const md = formatSessionSummary(session, [])
    const headerLine = md.split("\n")[0]

    expect(headerLine).not.toContain("program:")
    expect(headerLine).not.toContain("*(")
  })

  it("treats explicit programInfo: undefined the same as omitting the arg (handles ad-hoc callers)", () => {
    const session = makeSession({ workout_label_snapshot: "Push Day" })

    const md = formatSessionSummary(session, [], undefined)
    const headerLine = md.split("\n")[0]

    expect(headerLine).not.toContain("program:")
  })

  it("omits the annotation when programInfo.id is the empty string (defensive guard for legacy data)", () => {
    const session = makeSession({ workout_label_snapshot: "Push Day" })

    const md = formatSessionSummary(session, [], { id: "", name: "Mai 2026 v2" })
    const headerLine = md.split("\n")[0]

    expect(headerLine).not.toContain("program:")
    expect(headerLine).not.toContain("Mai 2026 v2")
  })
})

describe("formatWeightConvention", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each<[string, WeightConvention]>([
    ["dumbbell", "per_hand"],
    ["kettlebell", "per_hand"],
    ["barbell", "total"],
    ["machine", "total"],
    ["cable", "total"],
    ["bodyweight", "bodyweight"],
    ["band", "total"],
    ["other", "total"],
  ])(
    "maps known equipment '%s' to convention '%s' without warning",
    (equipment, expected) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

      const convention = formatWeightConvention(equipment)

      expect(convention).toBe(expected)
      expect(warn).not.toHaveBeenCalled()
    },
  )

  it("falls back to 'total' AND warns when equipment is unknown to the catalog", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const convention = formatWeightConvention("flux-capacitor")

    expect(convention).toBe("total")
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("flux-capacitor")
  })

  it("falls back to 'total' AND warns when equipment is the empty string (defensive)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const convention = formatWeightConvention("")

    expect(convention).toBe("total")
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe("formatPrescriptionLine — reps mode", () => {
  it("renders a barbell linear prescription with 'X kg total' suffix", () => {
    const line = formatPrescriptionLine({
      exerciseName: "Bench Press",
      sets: 4,
      reps: "8",
      weightKg: 80,
      restSeconds: 120,
      weightConvention: "total",
    })

    expect(line).toBe("Bench Press — 4 × 8 × 80 kg total — 120s rest")
  })

  it("renders a dumbbell double-progression prescription with 'X kg per hand' suffix", () => {
    const line = formatPrescriptionLine({
      exerciseName: "DB Curl",
      sets: 4,
      reps: "8-12",
      weightKg: 15,
      restSeconds: 90,
      weightConvention: "per_hand",
    })

    expect(line).toBe("DB Curl — 4 × 8-12 × 15 kg per hand — 90s rest")
  })

  it("renders a bodyweight prescription as '(bodyweight)' and omits the kg suffix", () => {
    const line = formatPrescriptionLine({
      exerciseName: "Pushup",
      sets: 4,
      reps: "12",
      weightKg: 0,
      restSeconds: 90,
      weightConvention: "bodyweight",
    })

    expect(line).toBe("Pushup — 4 × 12 (bodyweight) — 90s rest")
  })

  it("renders fractional weight using one decimal (e.g. 22.5 kg, not 22.50000001)", () => {
    const line = formatPrescriptionLine({
      exerciseName: "DB Curl",
      sets: 3,
      reps: "10",
      weightKg: 22.5,
      restSeconds: 60,
      weightConvention: "per_hand",
    })

    expect(line).toBe("DB Curl — 3 × 10 × 22.5 kg per hand — 60s rest")
  })
})

describe("formatPrescriptionLine — duration mode (T75)", () => {
  it("renders a bodyweight duration prescription as '{sets} × {N}s' (no kg suffix, no reps)", () => {
    const line = formatPrescriptionLine({
      exerciseName: "Plank",
      sets: 4,
      reps: "0",
      weightKg: 0,
      restSeconds: 60,
      weightConvention: "bodyweight",
      targetDurationSeconds: 30,
    })

    expect(line).toBe("Plank — 4 × 30s — 60s rest")
  })

  it("renders a longer duration with the same compact format", () => {
    const line = formatPrescriptionLine({
      exerciseName: "Hang",
      sets: 3,
      reps: "0",
      weightKg: 0,
      restSeconds: 90,
      weightConvention: "bodyweight",
      targetDurationSeconds: 60,
    })

    expect(line).toBe("Hang — 3 × 60s — 90s rest")
  })

  it("ignores reps and weightKg when targetDurationSeconds is set (duration mode wins)", () => {
    // Defensive: even if upstream callers forget to zero these out, the duration
    // branch should not leak them into the rendered line.
    const line = formatPrescriptionLine({
      exerciseName: "Plank",
      sets: 3,
      reps: "12",
      weightKg: 50,
      restSeconds: 60,
      weightConvention: "total",
      targetDurationSeconds: 45,
    })

    expect(line).toBe("Plank — 3 × 45s — 60s rest")
    expect(line).not.toContain("kg")
    expect(line).not.toContain("12")
  })
})

describe("formatActiveCycleWarning (T81)", () => {
  it("returns the French warning with YYYY-MM-DD extracted from the ISO started_at", () => {
    const warning = formatActiveCycleWarning({ started_at: "2026-04-15T10:00:00.000Z" })
    expect(warning).toBe(
      "Cycle actif depuis 2026-04-15 — cette modification affecte vos workouts restants dans ce cycle.",
    )
  })

  it("strips the time portion regardless of timezone offset (uses the literal date prefix of the ISO)", () => {
    const warning = formatActiveCycleWarning({ started_at: "2026-12-31T23:59:59+02:00" })
    expect(warning).toContain("Cycle actif depuis 2026-12-31")
  })
})

describe("formatProgramAfterUpdate (T81)", () => {
  const ID_PROGRAM = "11111111-1111-4111-8111-111111111111"
  const ID_DAY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const ID_DAY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const ID_BENCH = "cccccccc-1111-4111-8111-cccccccccccc"
  const ID_PUSHUP = "cccccccc-2222-4222-8222-cccccccccccc"

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

  const catalog = new Map([
    [ID_BENCH, BENCH],
    [ID_PUSHUP, PUSHUP],
  ])

  function makeCurrent(overrides: Partial<CurrentProgramSnapshot> = {}): CurrentProgramSnapshot {
    return {
      id: ID_PROGRAM,
      name: "PPL",
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
      ...overrides,
    }
  }

  function emptyDiff(overrides: Partial<ProgramDiff> = {}): ProgramDiff {
    return {
      program_id: ID_PROGRAM,
      name_change: null,
      days_to_insert: [],
      days_to_update: [],
      days_to_delete: [],
      days_unchanged: [],
      apply_order: "default",
      ...overrides,
    }
  }

  it("renders the program header with the renamed name when name_change is set", () => {
    const current = makeCurrent({ name: "Old name" })
    const diff = emptyDiff({
      name_change: { from: "Old name", to: "PPL v2" },
      days_unchanged: [{ id: ID_DAY_A, label: "Push" }],
    })

    const md = formatProgramAfterUpdate(diff, current, catalog)

    expect(md).toContain(`## **PPL v2** *(id: ${ID_PROGRAM})*`)
    expect(md).not.toContain("Old name")
  })

  it("renders the current name when name_change is null", () => {
    const current = makeCurrent({ name: "PPL" })
    const diff = emptyDiff({
      days_unchanged: [{ id: ID_DAY_A, label: "Push" }],
    })

    const md = formatProgramAfterUpdate(diff, current, catalog)

    expect(md).toContain(`## **PPL** *(id: ${ID_PROGRAM})*`)
  })

  it("renders unchanged days using their persisted workout_exercises (rest of program left untouched)", () => {
    const current = makeCurrent()
    const diff = emptyDiff({
      days_unchanged: [{ id: ID_DAY_A, label: "Push" }],
    })

    const md = formatProgramAfterUpdate(diff, current, catalog)

    expect(md).toContain("### 💪 Push")
    expect(md).toContain("Bench Press — 4 × 8 × 80 kg total — 120s rest")
  })

  it("renders updated days using their parsed_exercises (post-apply state) and the resolved emoji", () => {
    const current = makeCurrent()
    const diff = emptyDiff({
      days_to_update: [
        {
          id: ID_DAY_A,
          current: { label: "Push", emoji: "💪", sort_order: 0 },
          label: "Push v2",
          emoji: "💪",
          sort_order: 0,
          parsed_exercises: [
            {
              kind: "object",
              exerciseId: ID_BENCH,
              sets: 5,
              reps: "5",
              weightKg: 100,
              restSeconds: 180,
              targetDurationSeconds: null,
            },
          ],
        },
      ],
    })

    const md = formatProgramAfterUpdate(diff, current, catalog)

    expect(md).toContain("### 💪 Push v2")
    expect(md).toContain("Bench Press — 5 × 5 × 100 kg total — 180s rest")
    // Old prescription should NOT appear.
    expect(md).not.toContain("4 × 8 × 80 kg")
  })

  it("renders inserted days at the right position with their parsed_exercises (defaults applied to bare-string entries)", () => {
    const current = makeCurrent({
      days: [
        {
          id: ID_DAY_A,
          label: "Push",
          emoji: "💪",
          sort_order: 0,
          workout_exercises: [],
        },
      ],
    })
    const diff = emptyDiff({
      days_to_update: [
        {
          id: ID_DAY_A,
          current: { label: "Push", emoji: "💪", sort_order: 0 },
          label: "Push",
          emoji: "💪",
          sort_order: 0,
          parsed_exercises: [],
        },
      ],
      days_to_insert: [
        {
          label: "Pull",
          emoji: "🪝",
          sort_order: 1,
          parsed_exercises: [{ kind: "bare", exerciseId: ID_PUSHUP }],
        },
      ],
    })

    const md = formatProgramAfterUpdate(diff, current, catalog)

    expect(md).toContain("### 🪝 Pull")
    // Bare entry on a bodyweight reps exercise → default 3 × 10, bodyweight branch.
    expect(md).toContain("Push-up — 3 × 10 (bodyweight) — 90s rest")
  })

  it("excludes deleted days from the rendered output entirely", () => {
    const current = makeCurrent({
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
        {
          id: ID_DAY_B,
          label: "Drop me",
          emoji: "🗑️",
          sort_order: 1,
          workout_exercises: [],
        },
      ],
    })
    const diff = emptyDiff({
      days_to_delete: [{ id: ID_DAY_B, label: "Drop me", session_count: 0, blocking: false }],
      days_to_update: [
        {
          id: ID_DAY_A,
          current: { label: "Push", emoji: "💪", sort_order: 0 },
          label: "Push",
          emoji: "💪",
          sort_order: 0,
          parsed_exercises: [
            {
              kind: "object",
              exerciseId: ID_BENCH,
              sets: 4,
              reps: "8",
              weightKg: 80,
              restSeconds: 120,
              targetDurationSeconds: null,
            },
          ],
        },
      ],
    })

    const md = formatProgramAfterUpdate(diff, current, catalog)

    expect(md).not.toContain("Drop me")
    expect(md).not.toContain("🗑️")
    expect(md).toContain("### 💪 Push")
  })

  it("renders the empty-program placeholder when no days remain after the diff", () => {
    const current = makeCurrent({
      days: [
        {
          id: ID_DAY_A,
          label: "Last one",
          emoji: "💪",
          sort_order: 0,
          workout_exercises: [],
        },
      ],
    })
    // Hypothetical "delete the only day" diff (would be blocked by AC in practice,
    // but the renderer must not crash on an empty final state).
    const diff = emptyDiff({
      days_to_delete: [{ id: ID_DAY_A, label: "Last one", session_count: 0, blocking: false }],
    })

    const md = formatProgramAfterUpdate(diff, current, catalog)

    expect(md).toContain("_(empty program — no days defined)_")
  })
})
