import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { parseProfileAllTimeRollups } from "@/lib/profile/allTimeRollups"
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

export function useProfileLiveQueries(
  kind: ProfileWindowKind,
  live: boolean,
) {
  const snapshotQuery = useProfileSnapshot(kind)
  const rollupsQuery = useProfileAllTimeRollups(kind === "all")
  const boundedKind = kind === "all" ? null : kind
  return {
    snapshotQuery,
    rollupsQuery,
    boundedKind,
    liveBounded: live && boundedKind != null,
    liveAll: live && kind === "all",
  }
}

export function useProfileAllTimeRollups(enabled: boolean) {
  const user = useAtomValue(authAtom)
  const timeZone = getResolvedIANATimeZone()

  return useQuery({
    queryKey: ["profile-all-time-rollups", user?.id, timeZone],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profile_all_time_rollups", {
        p_tz: timeZone,
      })
      if (error) throw error
      return parseProfileAllTimeRollups(data)
    },
    enabled: Boolean(user) && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
