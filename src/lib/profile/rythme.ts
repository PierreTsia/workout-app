import {
  grainForKind,
  grainKey,
  localFinishedDay,
  profileBuckets,
  sessionsInRange,
} from "@/lib/profile/grain"
import type { MixWindow } from "@/lib/profile/mixSlice"
import type { ProfileSnapshot, RhythmVm } from "@/lib/profile/types"
import { isoDaysInclusive } from "@/lib/profile/windowRange"

export function buildRhythmVm(snapshot: ProfileSnapshot, input: MixWindow): RhythmVm {
  const buckets = profileBuckets(input.kind, input.from, input.to)
  const grain = grainForKind(input.kind)
  const windowDays = isoDaysInclusive(input.from, input.to)
  const trainedDays = [
    ...new Set(
      sessionsInRange(
        snapshot.sessions,
        input.from,
        input.to,
        input.timeZone,
      ).map((session) => localFinishedDay(session, input.timeZone)),
    ),
  ]

  return {
    categories: buckets.map((bucket) => bucket.label),
    hits: buckets.map((bucket) => {
      const trained = trainedDays.filter(
        (day) => grainKey(day, grain) === bucket.key,
      ).length
      if (grain !== "month") return trained
      const spanDays = windowDays.filter(
        (day) => grainKey(day, "month") === bucket.key,
      ).length
      if (spanDays === 0) return 0
      return Math.round((trained * 7) / spanDays)
    }),
  }
}

