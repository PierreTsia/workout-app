import { vi, describe, it, expect, beforeEach } from "vitest"
import { act, waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { authAtom } from "@/store/atoms"
import type { User } from "@/types/auth"
import { HYPERTROPHY_VOLUME_MIN } from "@/lib/programScore/bands"
import type { SlimDayRow, SlimSoloRow } from "@/lib/programScore/types"
import { useProgramsIntent } from "./useProgramsIntent"

const TEST_USER = { id: "user-1" } as User

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

type IntentDayRow = SlimDayRow & { program_id: string }

function makeDayRow(overrides: Partial<IntentDayRow> = {}): IntentDayRow {
  return {
    id: "day-1",
    program_id: "prog-1",
    label: "Push",
    sort_order: 0,
    workout_exercises: [makeSlimSolo()],
    exercise_blocks: [],
    ...overrides,
  }
}

const select = vi.fn()
const inFilter = vi.fn()
const order = vi.fn()

function mockDays(data: IntentDayRow[]) {
  const chain = {
    select,
    in: inFilter,
    order,
    returns: () => chain,
    then(
      onFulfilled: (value: { data: IntentDayRow[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
    },
  }
  select.mockReturnValue(chain)
  inFilter.mockReturnValue(chain)
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

describe("useProgramsIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDays([])
  })

  it("scores a batched slim week and hydrates each program-intent cache", async () => {
    mockDays([makeDayRow()])

    const { result, store, queryClient } = renderHookWithProviders(() =>
      useProgramsIntent(["prog-1", "prog-2"]),
    )
    const setQueryData = vi.spyOn(queryClient, "setQueryData")
    act(() => {
      store.set(authAtom, TEST_USER)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("secondary_muscles"),
    )
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("measurement_type"),
    )
    expect(select.mock.calls[0]?.[0]).not.toContain("instructions")
    expect(inFilter).toHaveBeenCalledWith("program_id", ["prog-1", "prog-2"])

    const scored = result.current.data
    expect(scored?.["prog-1"]?.facts.setCount).toBe(HYPERTROPHY_VOLUME_MIN)
    expect(scored?.["prog-1"]?.facts.dayCount).toBe(1)
    expect(scored?.["prog-1"]?.hypertrophy.band).toBe("short")
    expect(scored?.["prog-2"]?.hypertrophy.band).toBe("empty")
    expect(scored?.["prog-2"]?.balance).toEqual({ kind: "empty" })

    expect(setQueryData).toHaveBeenCalledWith(
      ["program-intent", "prog-1"],
      scored?.["prog-1"],
    )
    expect(setQueryData).toHaveBeenCalledWith(
      ["program-intent", "prog-2"],
      scored?.["prog-2"],
    )
  })
})
