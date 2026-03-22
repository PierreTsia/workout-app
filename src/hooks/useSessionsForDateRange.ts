import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Session } from "@/types/database"

/**
 * Finished sessions with `finished_at` in [rangeFrom, rangeTo] (inclusive),
 * aligned with `get_training_activity_by_day` day buckets (finished_at in user TZ).
 * Range bounds use JS Date → ISO like the visible month window from date-fns.
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
        .not("finished_at", "is", null)
        .gte("finished_at", fromIso)
        .lte("finished_at", toIso)
        .order("finished_at", { ascending: false })

      if (error) throw error
      return (data as Session[]) ?? []
    },
    enabled: !!user && rangeFrom.getTime() <= rangeTo.getTime(),
  })
}
