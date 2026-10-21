import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { slotKey, type SlotSessionSummary } from "@/lib/progression"

/** One **Exercise Slot** on the wire: the row id plus its catalog movement. */
export interface SlotRef {
  workoutExerciseId: string
  exerciseId: string
}

interface SlotPrescriptionHistoryRow {
  workout_exercise_id: string
  exercise_id: string
  session_id: string
  session_finished_at: string | null
  prescribed_reps: number | null
  anchor_reps: number | null
  prescribed_weight: number | null
  avg_rir: number | null
}

const EMPTY_HISTORY: Map<string, SlotSessionSummary[]> = new Map()

export interface SlotPrescriptionHistoryResult {
  /** `Map<slotKey, SlotSessionSummary[]>` ordered oldest → newest. */
  history: Map<string, SlotSessionSummary[]>
  /**
   * True while the query is in flight. Consumers must not compute a suggestion
   * before it settles: a non-deload target locked in that window would never
   * drop, and the Deload would re-fire every session.
   */
  isLoading: boolean
}

/**
 * The last few sessions of each slot, summarised for the **Stall** predicate
 * (ADR 0033): `Map<slotKey, SlotSessionSummary[]>` ordered oldest → newest.
 *
 * `before` bounds the window — in-session it is the session's start, so the live
 * session's own logs don't read as a served target. Omit it to let the RPC
 * default to `now()`.
 *
 * Any failure (RPC absent, plpgsql error, RLS) reads as **empty history**: the
 * engine computes without a Deload, exactly as before. Never thrown to the UI.
 */
export function useSlotPrescriptionHistory(
  slots: SlotRef[],
  before?: string | null,
): SlotPrescriptionHistoryResult {
  const pairs = slots
    .map((slot) => slotKey(slot.workoutExerciseId, slot.exerciseId))
    .sort()
    .join(",")

  const query = useQuery<Map<string, SlotSessionSummary[]>>({
    queryKey: ["slot-prescription-history", pairs, before ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_slot_prescription_history", {
        p_workout_exercise_ids: slots.map((s) => s.workoutExerciseId),
        p_exercise_ids: slots.map((s) => s.exerciseId),
        ...(before ? { p_before: before } : {}),
      })
      if (error) throw error

      return ((data ?? []) as SlotPrescriptionHistoryRow[]).reduce<
        Map<string, SlotSessionSummary[]>
      >((acc, row) => {
        const key = slotKey(row.workout_exercise_id, row.exercise_id)
        const summary: SlotSessionSummary = {
          sessionFinishedAt: row.session_finished_at,
          prescribedReps: row.prescribed_reps,
          anchorReps: row.anchor_reps,
          prescribedWeight: Number(row.prescribed_weight) || 0,
          avgRir: row.avg_rir == null ? null : Number(row.avg_rir),
        }
        const list = acc.get(key)
        if (list) {
          list.push(summary)
        } else {
          acc.set(key, [summary])
        }
        return acc
      }, new Map())
    },
    enabled: slots.length > 0,
    staleTime: 30_000,
  })

  return { history: query.data ?? EMPTY_HISTORY, isLoading: query.isLoading }
}
