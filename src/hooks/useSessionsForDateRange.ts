import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Session } from "@/types/database"

/**
 * Sessions in [rangeFrom, rangeTo] (inclusive): finished sessions whose
 * `finished_at` falls inside the range, plus unfinished sessions (#568) whose
 * `started_at` falls inside it. Aligned with `get_training_activity_by_day`
 * day buckets (finished_at in user TZ). Range bounds use JS Date → ISO like the
 * visible month window from date-fns.
 */
export function useSessionsForDateRange(rangeFrom: Date, rangeTo: Date) {
  const user = useAtomValue(authAtom)
  const fromIso = rangeFrom.toISOString()
  const toIso = rangeTo.toISOString()

  return useQuery<Session[]>({
    queryKey: ["sessions-date-range", user?.id, fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .or(
          `and(finished_at.gte.${fromIso},finished_at.lte.${toIso}),` +
            `and(finished_at.is.null,started_at.gte.${fromIso},started_at.lte.${toIso})`,
        )
        .order("started_at", { ascending: false })

      if (error) throw error
      return (data as Session[]) ?? []
    },
    enabled: !!user && rangeFrom.getTime() <= rangeTo.getTime(),
  })
}
