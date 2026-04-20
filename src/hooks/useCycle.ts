import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Cycle, Session, WorkoutDay } from "@/types/database"

export function useActiveCycle(programId: string | null) {
  return useQuery<Cycle | null>({
    queryKey: ["active-cycle", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cycles")
        .select("*")
        .eq("program_id", programId!)
        .is("finished_at", null)
        .single()

      if (error?.code === "PGRST116") return null
      if (error) throw error
      return data
    },
    enabled: !!programId,
  })
}

interface CycleProgress {
  completedDayIds: string[]
  totalDays: number
  nextDayId: string | null
  isComplete: boolean
  /** True while the inner `cycle-sessions` query is in its first fetch. False when no cycle (query idle). */
  isLoading: boolean
}

export function useCycleProgress(
  cycleId: string | null,
  days: WorkoutDay[],
): CycleProgress {
  const { data: cycleSessions, isLoading } = useQuery<
    Pick<Session, "workout_day_id">[]
  >({
    queryKey: ["cycle-sessions", cycleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("workout_day_id")
        .eq("cycle_id", cycleId!)
        .not("finished_at", "is", null)

      if (error) throw error
      return data ?? []
    },
    enabled: !!cycleId,
  })

  return useMemo(() => {
    const completedSet = new Set(
      cycleSessions
        ?.map((s) => s.workout_day_id)
        .filter((id): id is string => id != null) ?? [],
    )
    const totalDays = days.length
    const nextDayId = days.find((d) => !completedSet.has(d.id))?.id ?? null
    return {
      completedDayIds: [...completedSet],
      totalDays,
      nextDayId,
      isComplete: totalDays > 0 && completedSet.size >= totalDays,
      isLoading,
    }
  }, [cycleSessions, days, isLoading])
}
