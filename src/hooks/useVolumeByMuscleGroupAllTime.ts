import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { fetchVolumeByMuscleGroupAllTime } from "@/lib/volumeByMuscleGroup"
import { authAtom } from "@/store/atoms"

export function useVolumeByMuscleGroupAllTime(options?: { enabled?: boolean }) {
  const user = useAtomValue(authAtom)
  return useQuery({
    queryKey: ["volume-distribution-all-time", user?.id],
    queryFn: async () => fetchVolumeByMuscleGroupAllTime(supabase, user!.id),
    enabled: Boolean(user) && (options?.enabled ?? true),
  })
}
