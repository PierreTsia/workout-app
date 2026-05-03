import { describe, expect, it } from "vitest"
import {
  parsePatchShape,
  requireConfirmForDestructive,
  validateDayIdentities,
} from "./updateProgramValidation"
import type { ParsedPatchDay, ProgramDiff } from "./updateProgramTypes"

const PROGRAM_ID = "11111111-2222-4333-8444-555555555555"
const DAY_ID_1 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const DAY_ID_2 = "cccccccc-dddd-4eee-8fff-000000000000"
const EX_ID = "22222222-3333-4444-8555-666666666666"

function makeDayInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    label: "Push",
    exercises: [EX_ID],
    ...overrides,
  }
}

function makePatchDay(overrides: Partial<ParsedPatchDay> = {}): ParsedPatchDay {
  return {
    label: "Push",
    parsed_exercises: [],
    ...overrides,
  }
}

function makeDiff(overrides: Partial<ProgramDiff> = {}): ProgramDiff {
  return {
    program_id: PROGRAM_ID,
    name_change: null,
    days_to_insert: [],
    days_to_update: [],
    days_to_delete: [],
    days_unchanged: [],
    apply_order: "default",
    ...overrides,
  }
}

describe("parsePatchShape", () => {
  it("rejects `is_active` with a pointer to set_active_program (BEFORE generic shape errors)", () => {
    // Even with a malformed program_id, the is_active rejection wins because
    // it leads the agent to the right tool instead of a dead-end.
    const result = parsePatchShape({ program_id: "not-a-uuid", is_active: true })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe(
      "`is_active` is not editable via update_program. Use the dedicated `set_active_program` tool (coming soon).",
    )
  })

  it("rejects a non-UUID program_id", () => {
    const result = parsePatchShape({ program_id: "not-a-uuid" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("Invalid program_id format (expected UUID).")
  })

  it("rejects an empty `name`", () => {
    const result = parsePatchShape({ program_id: PROGRAM_ID, name: "  " })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("`name` must be a non-empty string when provided.")
  })

  it("rejects an empty `days` array (with omit-the-field hint)", () => {
    const result = parsePatchShape({ program_id: PROGRAM_ID, days: [] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe(
      "`days` must be a non-empty array when provided. Omit the field entirely to leave days unchanged, or pass at least one day.",
    )
  })

  it("rejects more than 14 days", () => {
    const fifteen = Array.from({ length: 15 }, () => makeDayInput())
    const result = parsePatchShape({ program_id: PROGRAM_ID, days: fifteen })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("days: too many entries (max 14).")
  })

  it("rejects a day missing its label", () => {
    const result = parsePatchShape({
      program_id: PROGRAM_ID,
      days: [{ exercises: [EX_ID] }],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("days[0].label must be a non-empty string.")
  })

  it("rejects a day with an empty `exercises` array", () => {
    const result = parsePatchShape({
      program_id: PROGRAM_ID,
      days: [{ label: "Push", exercises: [] }],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe(
      "days[0].exercises must be a non-empty array (≥1 exercise per day).",
    )
  })

  it("rejects a day whose `id` is not a UUID", () => {
    const result = parsePatchShape({
      program_id: PROGRAM_ID,
      days: [makeDayInput({ id: "not-a-uuid" })],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("days[0].id must be a UUID when provided.")
  })

  it("rejects a non-boolean `dry_run`", () => {
    const result = parsePatchShape({ program_id: PROGRAM_ID, dry_run: "yes" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("`dry_run` must be a boolean.")
  })

  it("rejects a non-boolean `confirm`", () => {
    const result = parsePatchShape({ program_id: PROGRAM_ID, confirm: 1 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("`confirm` must be a boolean.")
  })

  it("happy path: resolves dry_run=true and confirm=false defaults when omitted", () => {
    const result = parsePatchShape({ program_id: PROGRAM_ID })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.program_id).toBe(PROGRAM_ID)
    expect(result.value.dry_run).toBe(true)
    expect(result.value.confirm).toBe(false)
    expect(result.value.name).toBeUndefined()
    expect(result.value.days).toBeUndefined()
  })

  it("happy path with full payload: trims name, preserves day id, and stubs parsed_exercises (filled by handler)", () => {
    const result = parsePatchShape({
      program_id: PROGRAM_ID,
      name: "  PPL 6w  ",
      days: [makeDayInput({ id: DAY_ID_1, emoji: "💪" })],
      dry_run: false,
      confirm: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.name).toBe("PPL 6w")
    expect(result.value.dry_run).toBe(false)
    expect(result.value.confirm).toBe(true)
    expect(result.value.days).toEqual([
      { id: DAY_ID_1, label: "Push", emoji: "💪", parsed_exercises: [] },
    ])
  })
})

describe("validateDayIdentities", () => {
  it("rejects two patch days that share the same id and names BOTH positions", () => {
    const result = validateDayIdentities(
      [
        makePatchDay({ id: DAY_ID_1, label: "Push" }),
        makePatchDay({ id: DAY_ID_1, label: "Push (dup)" }),
      ],
      new Set([DAY_ID_1]),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe(
      `days[0] and days[1] both reference id '${DAY_ID_1}'. Each day id may appear at most once in the patch.`,
    )
  })

  it("rejects a day id that is not in the current program", () => {
    const result = validateDayIdentities(
      [makePatchDay({ id: DAY_ID_2 })],
      new Set([DAY_ID_1]),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe(
      `days[0].id '${DAY_ID_2}' is not a day of the current program. Omit the id to create a new day, or check the id.`,
    )
  })

  it("accepts a mix of new-day (no id) and existing-day (id in current program)", () => {
    const result = validateDayIdentities(
      [makePatchDay({ label: "New" }), makePatchDay({ id: DAY_ID_1, label: "Existing" })],
      new Set([DAY_ID_1]),
    )
    expect(result.ok).toBe(true)
  })
})

describe("requireConfirmForDestructive", () => {
  it("rejects a destructive patch when confirm is false, listing each removed day's label", () => {
    const diff = makeDiff({
      days_to_delete: [
        { id: DAY_ID_1, label: "Cardio", session_count: 0, blocking: false },
      ],
    })
    const result = requireConfirmForDestructive(diff, false)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe(
      "Patch removes 1 day(s): Cardio. Pass `confirm: true` along with `dry_run: false` to apply, or revise the payload to keep these days.",
    )
  })

  it("accepts a destructive patch when confirm is true", () => {
    const diff = makeDiff({
      days_to_delete: [
        { id: DAY_ID_1, label: "Cardio", session_count: 0, blocking: false },
      ],
    })
    expect(requireConfirmForDestructive(diff, true)).toEqual({ ok: true })
  })

  it("accepts a non-destructive patch regardless of confirm", () => {
    const diff = makeDiff({ days_to_delete: [] })
    expect(requireConfirmForDestructive(diff, false)).toEqual({ ok: true })
  })
})
