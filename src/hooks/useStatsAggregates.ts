import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

export interface StatsAggregates {
  totalSessions: number
  totalSets: number
  totalPRs: number
}

export function useStatsAggregates() {
  const user = useAtomValue(authAtom)

  return useQuery<StatsAggregates>({
    queryKey: ["pr-aggregates"],
    queryFn: async () => {
      const [sessionsRes, setsRes, prsRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("*", { count: "exact", head: true })
          .not("finished_at", "is", null),
        supabase
          .from("set_logs")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("set_logs")
          .select("*", { count: "exact", head: true })
          .eq("was_pr", true),
      ])

      if (sessionsRes.error) throw sessionsRes.error
      if (setsRes.error) throw setsRes.error
      if (prsRes.error) throw prsRes.error

      return {
        totalSessions: sessionsRes.count ?? 0,
        totalSets: setsRes.count ?? 0,
        totalPRs: prsRes.count ?? 0,
      }
    },
    enabled: !!user,
  })
}
