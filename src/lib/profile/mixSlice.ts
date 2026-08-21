import {
  grainForKind,
  grainKey,
  localFinishedDay,
  profileBuckets,
  sessionsInRange,
  type GrainBucket,
  type ProfileGrain,
} from "@/lib/profile/grain"
import type {
  MixSeries,
  MixVm,
  ProfileAllTimeRollups,
  ProfileSnapshot,
  SessionFact,
} from "@/lib/profile/types"
import type { ProfileWindowKind } from "@/lib/profile/window"

export type MixSliceKind = "circuits" | "quickWorkout" | "programme"

type BoundedKind = Exclude<ProfileWindowKind, "all">

export type MixWindow = {
  kind: BoundedKind
  from: string
  to: string
  timeZone: string
}

function countSlice(
  sessions: readonly SessionFact[],
  buckets: readonly GrainBucket[],
  slice: MixSliceKind,
  timeZone: string,
  grain: ProfileGrain,
): number[] {
  return buckets.map(
    (bucket) =>
      sessions.filter(
        (session) =>
          grainKey(localFinishedDay(session, timeZone), grain) === bucket.key &&
          mixSlice(session) === slice,
      ).length,
  )
}

export function buildMixVm(snapshot: ProfileSnapshot, input: MixWindow): MixVm {
  const current = sessionsInRange(
    snapshot.sessions,
    input.from,
    input.to,
    input.timeZone,
  )
  if (current.length === 0) return { status: "empty" }

  const grain = grainForKind(input.kind)
  const buckets = profileBuckets(input.kind, input.from, input.to)
  const series: MixSeries = {
    programme: countSlice(current, buckets, "programme", input.timeZone, grain),
    quickWorkout: countSlice(current, buckets, "quickWorkout", input.timeZone, grain),
    circuits: countSlice(current, buckets, "circuits", input.timeZone, grain),
  }

  return {
    status: "ok",
    categories: buckets.map((bucket) => bucket.label),
    series,
  }
}

export function mixSlice(session: {
  has_catalog_circuit: boolean
  program_id: string | null
}): MixSliceKind {
  if (session.has_catalog_circuit) return "circuits"
  if (session.program_id == null) return "quickWorkout"
  return "programme"
}

export type MixSliceVector = {
  name: string
  has_catalog_circuit: boolean
  program_id: string | null
  expected: MixSliceKind
}

/** Shared with T234 SQL rollup tests — Mix precedence is identical in TS and SQL. */
export const MIX_SLICE_SQL = `CASE
  WHEN has_catalog_circuit THEN 'circuits'
  WHEN program_id IS NULL THEN 'quickWorkout'
  ELSE 'programme'
END`

export const MIX_SLICE_VECTORS: MixSliceVector[] = [
  {
    name: "programmed Cindy",
    has_catalog_circuit: true,
    program_id: "upper-lower",
    expected: "circuits",
  },
  {
    name: "jetable Circuit on a Program day",
    has_catalog_circuit: false,
    program_id: "upper-lower",
    expected: "programme",
  },
  {
    name: "Quick Workout",
    has_catalog_circuit: false,
    program_id: null,
    expected: "quickWorkout",
  },
  {
    name: "jetable Circuit on a Quick Workout",
    has_catalog_circuit: false,
    program_id: null,
    expected: "quickWorkout",
  },
]

export function buildMixVmFromRollups(rollups: ProfileAllTimeRollups): MixVm {
  const years = rollups.years
  const sessionCount = years.reduce((sum, year) => sum + year.session_count, 0)
  if (sessionCount === 0) return { status: "empty" }

  return {
    status: "ok",
    categories: years.map((year) => String(year.year)),
    series: {
      programme: years.map((year) => year.mix.programme),
      quickWorkout: years.map((year) => year.mix.quickWorkout),
      circuits: years.map((year) => year.mix.circuits),
    },
  }
}
