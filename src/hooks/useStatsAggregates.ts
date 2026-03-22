import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { fetchGlobalStatsAggregates, type StatsAggregates } from "@/lib/fetchGlobalStatsAggregates"
import { authAtom } from "@/store/atoms"

export type { StatsAggregates }

export function useStatsAggregates() {
  const user = useAtomValue(authAtom)

  return useQuery<StatsAggregates>({
    queryKey: ["pr-aggregates"],
    queryFn: () => fetchGlobalStatsAggregates(supabase),
    enabled: !!user,
  })
}
