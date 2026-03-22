import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Session } from "@/types/database"

/**
 * Finished sessions with `started_at` in [rangeFrom, rangeTo] (inclusive),
 * using JS Date → ISO for the query window (local wall-clock intent).
 */
export function useSessionsForDateRange(rangeFrom: Date, rangeTo: Date) {
  const user = useAtomValue(authAtom)
  const fromIso = rangeFrom.toISOString()
  const toIso = rangeTo.toISOString()

  return useQuery<Session[]>({
    queryKey: ["sessions-date-range", fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .not("finished_at", "is", null)
        .gte("started_at", fromIso)
        .lte("started_at", toIso)
        .order("started_at", { ascending: false })

      if (error) throw error
      return (data as Session[]) ?? []
    },
    enabled: !!user && rangeFrom.getTime() <= rangeTo.getTime(),
  })
}
