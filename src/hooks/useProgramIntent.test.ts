import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { HYPERTROPHY_VOLUME_MIN } from "@/lib/programScore/bands"
import type { SlimDayRow, SlimSoloRow } from "@/lib/programScore/types"
import { useProgramIntent } from "./useProgramIntent"

function makeSlimSolo(overrides: Partial<SlimSoloRow> = {}): SlimSoloRow {
  return {
    sets: HYPERTROPHY_VOLUME_MIN,
    rest_seconds: 90,
    reps: "10",
    muscle_snapshot: "Pectoraux",
    exercise: {
      muscle_group: "Pectoraux",
      secondary_muscles: ["Triceps"],
      equipment: "barbell",
      measurement_type: "reps",
    },
    ...overrides,
  }
}

function makeDayRow(overrides: Partial<SlimDayRow> = {}): SlimDayRow {
  return {
    id: "day-1",
    label: "Push",
    emoji: "🔥",
    sort_order: 0,
    workout_exercises: [makeSlimSolo()],
    exercise_blocks: [],
    ...overrides,
  }
}

const select = vi.fn()
const eq = vi.fn()
const order = vi.fn()

function mockDays(data: SlimDayRow[]) {
  const chain = {
    select,
    eq,
    order,
    returns: () => chain,
    then(
      onFulfilled: (value: { data: SlimDayRow[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
    },
  }
  select.mockReturnValue(chain)
  eq.mockReturnValue(chain)
  order.mockReturnValue(chain)
  return chain
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select,
    })),
  },
}))

describe("useProgramIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDays([])
  })

  it("scores one program's slim week under program-intent", async () => {
    mockDays([makeDayRow()])

    const { result } = renderHookWithProviders(() => useProgramIntent("prog-1"))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("secondary_muscles"),
    )
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("measurement_type"),
    )
    expect(select.mock.calls[0]?.[0]).not.toContain("instructions")
    expect(eq).toHaveBeenCalledWith("program_id", "prog-1")

    expect(result.current.data?.facts.setCount).toBe(HYPERTROPHY_VOLUME_MIN)
    expect(result.current.data?.facts.dayCount).toBe(1)
    expect(result.current.data?.hypertrophy.band).toBe("short")
    expect(result.current.data?.hypertrophyExample?.muscle).toBe("Pectoraux")
  })
})
