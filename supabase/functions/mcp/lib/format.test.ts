import { describe, expect, it } from "vitest"
import { formatProgramListEntry } from "./format"

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
