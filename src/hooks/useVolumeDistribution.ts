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

export function useVolumeDistribution(days: number = DEFAULT_DAYS) {
  const user = useAtomValue(authAtom)

  return useQuery<VolumeDistributionData>({
    queryKey: ["volume-distribution", user?.id, days],
    queryFn: async () => {
      const uid = user!.id
      const [current, previous] = await Promise.all([
        fetchVolumeByMuscleGroup(supabase, uid, days, 0),
        fetchVolumeByMuscleGroup(supabase, uid, days, days),
      ])
      return { current, previous, days }
    },
    enabled: !!user,
  })
}
