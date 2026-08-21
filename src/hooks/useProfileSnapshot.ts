import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { parseProfileSnapshot } from "@/lib/profile/snapshot"
import {
  isoDayInTimeZone,
  snapshotHorizon,
  snapshotPrefetchRange,
} from "@/lib/profile/windowRange"
import type { ProfileWindowKind } from "@/lib/profile/window"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { authAtom } from "@/store/atoms"

export function useProfileSnapshot(kind: ProfileWindowKind) {
  const user = useAtomValue(authAtom)
  const timeZone = getResolvedIANATimeZone()
  const horizon = snapshotHorizon(kind)
  const today = isoDayInTimeZone(new Date(), timeZone)
  const range = horizon == null ? null : snapshotPrefetchRange(horizon, today)

  return useQuery({
    queryKey: ["profile-snapshot", user?.id, horizon, timeZone],
    queryFn: async () => {
      if (range == null) {
        throw new Error("get_profile_snapshot: All time is not a snapshot window")
      }
      const { data, error } = await supabase.rpc("get_profile_snapshot", {
        p_from: range.from,
        p_to: range.to,
        p_tz: timeZone,
      })
      if (error) throw error
      return parseProfileSnapshot(data)
    },
    enabled: Boolean(user) && range != null,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
