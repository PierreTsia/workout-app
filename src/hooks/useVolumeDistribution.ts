import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import {
  fetchVolumeByMuscleGroup,
  type VolumeByMuscleResult,
} from "@/lib/volumeByMuscleGroup"
import { authAtom } from "@/store/atoms"

const DEFAULT_DAYS = 30

export interface VolumeDistributionData {
  current: VolumeByMuscleResult
  previous: VolumeByMuscleResult
  days: number
}

export function useVolumeDistribution(
  days: number = DEFAULT_DAYS,
  options?: { includePrevious?: boolean; enabled?: boolean },
) {
  const user = useAtomValue(authAtom)
  const includePrevious = options?.includePrevious ?? true
  const boundedDays = Math.min(Math.max(days, 1), 365)

  return useQuery<VolumeDistributionData>({
    queryKey: ["volume-distribution", user?.id, boundedDays, includePrevious],
    queryFn: async () => {
      const uid = user!.id
      const current = await fetchVolumeByMuscleGroup(supabase, uid, boundedDays, 0)
      const previous = includePrevious
        ? await fetchVolumeByMuscleGroup(supabase, uid, boundedDays, boundedDays)
        : { finished_sessions: 0, muscles: [] }
      return { current, previous, days: boundedDays }
    },
    enabled: Boolean(user) && (options?.enabled ?? true),
  })
}
