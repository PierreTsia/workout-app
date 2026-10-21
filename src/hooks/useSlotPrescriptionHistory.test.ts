import { describe, it, expect, vi, beforeEach } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { useSlotPrescriptionHistory } from "./useSlotPrescriptionHistory"
import { slotKey } from "@/lib/progression"

const rpcMock = vi.fn()

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workout_exercise_id: "we-1",
    exercise_id: "ex-1",
    session_id: "sess-1",
    session_finished_at: "2026-05-01T10:30:00Z",
    prescribed_reps: 10,
    anchor_reps: null,
    prescribed_weight: 80,
    avg_rir: 1,
    ...overrides,
  }
}

const SLOT = { workoutExerciseId: "we-1", exerciseId: "ex-1" }

describe("useSlotPrescriptionHistory", () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it("maps one row per (slot, session) into a Map, and passes the window bound", async () => {
    rpcMock.mockResolvedValue({
      data: [
        makeRow({ session_id: "sess-1" }),
        makeRow({ session_id: "sess-2", prescribed_weight: 77.5, avg_rir: null }),
      ],
      error: null,
    })

    const { result } = renderHookWithProviders(() =>
      useSlotPrescriptionHistory([SLOT], "2026-06-01T00:00:00Z"),
    )

    await waitFor(() =>
      expect(result.current.history.get(slotKey("we-1", "ex-1"))).toHaveLength(2),
    )

    expect(rpcMock).toHaveBeenCalledWith("get_slot_prescription_history", {
      p_workout_exercise_ids: ["we-1"],
      p_exercise_ids: ["ex-1"],
      p_before: "2026-06-01T00:00:00Z",
    })
    expect(result.current.history.get(slotKey("we-1", "ex-1"))![1]).toEqual({
      sessionFinishedAt: "2026-05-01T10:30:00Z",
      prescribedReps: 10,
      anchorReps: null,
      prescribedWeight: 77.5,
      avgRir: null,
    })
  })

  it("coerces a null prescribed_weight to 0 (bodyweight)", async () => {
    rpcMock.mockResolvedValue({
      data: [makeRow({ prescribed_weight: null })],
      error: null,
    })

    const { result } = renderHookWithProviders(() =>
      useSlotPrescriptionHistory([SLOT]),
    )

    await waitFor(() =>
      expect(result.current.history.get(slotKey("we-1", "ex-1"))).toHaveLength(1),
    )
    expect(result.current.history.get(slotKey("we-1", "ex-1"))![0].prescribedWeight).toBe(0)
  })

  // The safe degradation of ADR 0033: a missing or broken RPC must read as "no
  // history" — no Deload, the normal engine — and never throw to the UI.
  it("returns an empty Map when the RPC errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "function public.get_slot_prescription_history does not exist" },
    })

    const { result } = renderHookWithProviders(() =>
      useSlotPrescriptionHistory([SLOT]),
    )

    // Wait for the query to settle (isLoading flips false only once the error
    // has been observed) — asserting before that would pass on the initial
    // empty state and never exercise the error path.
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(rpcMock).toHaveBeenCalled()
    expect(result.current.history.size).toBe(0)
  })

  it("returns an empty Map and skips the RPC when there is no slot", () => {
    const { result } = renderHookWithProviders(() => useSlotPrescriptionHistory([]))

    expect(result.current.history.size).toBe(0)
    expect(result.current.isLoading).toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
