import { describe, expect, it } from "vitest"
import { formatProgramDetails, formatProgramListEntry, formatSessionSummary } from "./format"

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
  name_snapshot: string
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
  it("renders a single-day program with multiple exercises, surfacing inline UUIDs on program/day/exercise lines", () => {
    const program = makeProgram()
    const day = makeDay()
    const exercises = [
      makeExercise({
        id: "33333333-3333-4333-8333-333333333333",
        name_snapshot: "Bench Press",
        sets: 4,
        reps: "8",
        weight: "80",
        rest_seconds: 120,
      }),
      makeExercise({
        id: "44444444-4444-4444-8444-444444444444",
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
        "  - **Bench Press** *(id: 33333333-3333-4333-8333-333333333333)*: 4 × 8 reps @ 80 kg (rest 120s)\n" +
        "  - **Overhead Press** *(id: 44444444-4444-4444-8444-444444444444)*: 3 × 10 reps @ 40 kg (rest 90s)",
    )
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
        name_snapshot: "Pull-up",
        sets: 4,
        reps: "8",
        weight: "0",
        rest_seconds: 90,
      }),
    ]
    const exercisesByDay = new Map([[day.id, exercises]])

    const md = formatProgramDetails(program, [day], exercisesByDay)

    expect(md).toContain("**Pull-up** *(id: ffffffff-ffff-4fff-8fff-ffffffffffff)*: 4 × 8 reps (rest 90s)")
    expect(md).not.toContain("@ 0 kg")
  })

  it("renders '{sets} × {N}s' when an exercise has target_duration_seconds set instead of reps", () => {
    const program = makeProgram()
    const day = makeDay()
    const exercises = [
      makeExercise({
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
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

    expect(md).toContain("**Plank** *(id: eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee)*: 3 × 45s (rest 60s)")
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
