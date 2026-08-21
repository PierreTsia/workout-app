import { isoDayDiff } from "@/lib/profile/windowRange"
import type { RegularRow } from "@/lib/profile/regulars"
import type { RecordsVm } from "@/lib/profile/records"
import type { TonnageVm } from "@/lib/profile/tonnage"
import type {
  AllTimeRegular,
  ProfileAllTimeRollups,
  PulseVm,
  RhythmVm,
  YearMixCounts,
  YearRollup,
} from "@/lib/profile/types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function parseMix(raw: unknown): YearMixCounts | null {
  if (!isRecord(raw)) return null
  const programme = asFiniteNumber(raw.programme)
  const quickWorkout = asFiniteNumber(raw.quickWorkout)
  const circuits = asFiniteNumber(raw.circuits)
  if (programme == null || quickWorkout == null || circuits == null) return null
  return { programme, quickWorkout, circuits }
}

function parseYear(raw: unknown): YearRollup | null {
  if (!isRecord(raw)) return null
  const year = asFiniteNumber(raw.year)
  const mix = parseMix(raw.mix)
  const tonnage_kg = asFiniteNumber(raw.tonnage_kg)
  const pr_pairs = asFiniteNumber(raw.pr_pairs)
  const rir0_num = asFiniteNumber(raw.rir0_num)
  const rir0_den = asFiniteNumber(raw.rir0_den)
  const session_count = asFiniteNumber(raw.session_count)
  const duration_ms = asFiniteNumber(raw.duration_ms)
  if (
    year == null ||
    mix == null ||
    tonnage_kg == null ||
    pr_pairs == null ||
    rir0_num == null ||
    rir0_den == null ||
    session_count == null ||
    duration_ms == null
  ) {
    return null
  }
  return {
    year,
    mix,
    tonnage_kg,
    pr_pairs,
    rir0_num,
    rir0_den,
    session_count,
    duration_ms,
  }
}

function parseRegular(raw: unknown): AllTimeRegular | null {
  if (!isRecord(raw)) return null
  const exercise_id = asString(raw.exercise_id)
  const last_logged_at = asString(raw.last_logged_at)
  if (exercise_id == null || last_logged_at == null) return null
  if (raw.reps === null) {
    return { exercise_id, reps: null, last_logged_at }
  }
  const reps = asFiniteNumber(raw.reps)
  if (reps == null) return null
  return { exercise_id, reps, last_logged_at }
}

export function parseProfileAllTimeRollups(data: unknown): ProfileAllTimeRollups {
  if (!isRecord(data)) {
    throw new Error("get_profile_all_time_rollups: expected year buckets")
  }
  const yearsRaw = Array.isArray(data.years) ? data.years : []
  const programRaw = Array.isArray(data.program_ids) ? data.program_ids : []
  const regularsRaw = Array.isArray(data.regulars) ? data.regulars : []
  const pr_exercise_count = asFiniteNumber(data.pr_exercise_count) ?? 0
  const last_pr_day =
    data.last_pr_day === null || data.last_pr_day === undefined
      ? null
      : asString(data.last_pr_day)

  return {
    years: yearsRaw
      .map(parseYear)
      .filter((year): year is YearRollup => year != null),
    program_ids: programRaw
      .map(asString)
      .filter((id): id is string => id != null),
    regulars: regularsRaw
      .map(parseRegular)
      .filter((row): row is AllTimeRegular => row != null),
    pr_exercise_count,
    last_pr_day,
  }
}

function yearLabels(years: readonly YearRollup[]): string[] {
  return years.map((year) => String(year.year))
}

export function buildPulseVmFromRollups(
  rollups: ProfileAllTimeRollups,
  prescribedMinutes: number | null,
): PulseVm {
  const sessions = rollups.years.reduce((sum, year) => sum + year.session_count, 0)
  if (sessions === 0) return { status: "empty" }
  const durationMs = rollups.years.reduce((sum, year) => sum + year.duration_ms, 0)
  return {
    status: "ok",
    sessions,
    sessionDelta: null,
    durationMs,
    durationDeltaMs: null,
    avgMinutes: Math.round(durationMs / sessions / 60_000),
    prescribedMinutes,
  }
}

export function buildRhythmVmFromRollups(rollups: ProfileAllTimeRollups): RhythmVm {
  return {
    categories: yearLabels(rollups.years),
    hits: rollups.years.map((year) => year.session_count),
  }
}

export function buildTonnageVmFromRollups(rollups: ProfileAllTimeRollups): TonnageVm {
  const tonnes =
    rollups.years.reduce((sum, year) => sum + year.tonnage_kg, 0) / 1000
  if (tonnes <= 0) return { status: "empty" }
  return {
    status: "ok",
    tonnes,
    deltaTonnes: null,
    categories: yearLabels(rollups.years),
    bars: rollups.years.map((year) => year.tonnage_kg / 1000),
  }
}

function rir0Point(year: YearRollup): number | null {
  if (year.rir0_den <= 0) return null
  return Math.round((year.rir0_num / year.rir0_den) * 100)
}

export function buildRecordsVmFromRollups(
  rollups: ProfileAllTimeRollups,
  today: string,
): RecordsVm {
  const prs = rollups.years.reduce((sum, year) => sum + year.pr_pairs, 0)
  if (prs === 0) return { status: "empty" }
  const rirSeries = rollups.years.map(rir0Point)
  const declared = rirSeries.filter((rate) => rate != null).length
  return {
    status: "ok",
    prs,
    prsDelta: null,
    exercises: rollups.pr_exercise_count,
    exercisesDelta: null,
    daysSinceLast:
      rollups.last_pr_day == null ? 0 : isoDayDiff(rollups.last_pr_day, today),
    daysSinceLastDelta: null,
    categories: yearLabels(rollups.years),
    series: {
      prs: rollups.years.map((year) => year.pr_pairs),
      rir0: declared < 2 ? rollups.years.map(() => null) : rirSeries,
    },
  }
}

export function regularsFromRollups(
  rollups: ProfileAllTimeRollups,
  names?: Readonly<Record<string, string>>,
): RegularRow[] {
  return rollups.regulars.map((row) => ({
    name: names?.[row.exercise_id] ?? row.exercise_id,
    reps: row.reps,
  }))
}
