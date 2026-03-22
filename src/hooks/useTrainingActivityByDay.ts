import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { authAtom } from "@/store/atoms"
import type { TrainingDayBucketRow } from "@/types/history"

export function useTrainingActivityByDay(pFrom: string, pTo: string, tzOverride?: string) {
  const user = useAtomValue(authAtom)
  const tz = tzOverride ?? getResolvedIANATimeZone()

  return useQuery({
    queryKey: ["training-activity-by-day", pFrom, pTo, tz],
    queryFn: async (): Promise<TrainingDayBucketRow[]> => {
      const { data, error } = await supabase.rpc("get_training_activity_by_day", {
        p_from: pFrom,
        p_to: pTo,
        p_tz: tz,
      })
      if (error) throw error
      const rows = (data ?? []) as { day: string; session_count: number | string; minutes: number | string }[]
      return rows.map((r) => ({
        day: typeof r.day === "string" ? r.day.slice(0, 10) : String(r.day).slice(0, 10),
        session_count: Number(r.session_count),
        minutes: Number(r.minutes),
      }))
    },
    enabled: !!user && pFrom <= pTo,
  })
}
