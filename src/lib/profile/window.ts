import type { BadgeStatusRow } from "@/types/achievements"

export const PROFILE_WINDOW_KINDS = ["7", "30", "100", "365", "all"] as const

export type ProfileWindowKind = (typeof PROFILE_WINDOW_KINDS)[number]

export function includeDeltas(kind: ProfileWindowKind): boolean {
  return kind !== "all"
}

export const MIX_CATEGORIES: Record<ProfileWindowKind, readonly string[]> = {
  "7": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "30": ["W1", "W2", "W3", "W4", "W5"],
  "100": ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
  "365": [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  all: ["2024", "2025", "2026"],
}

/** Pierre's prescribed training days / week (account questionnaire). */
export const PIERRE_WEEKLY_TARGET = 4

export type RhythmHits = {
  hits: readonly number[]
  deloadAt?: number
}

/** Sessions per cluster, oldest first. Weeks over the target keep the extra sessions. */
export function pierreRhythmHits(kind: ProfileWindowKind): RhythmHits {
  if (kind === "7") {
    return { hits: [1, 1, 1, 1, 1, 0, 0] }
  }
  if (kind === "30") {
    return { hits: [4, 4, 2, 4, 4] }
  }
  if (kind === "100") {
    return { hits: [4, 3, 4, 2, 4, 6, 5, 4, 3, 4, 4, 7], deloadAt: 3 }
  }
  if (kind === "365") {
    return { hits: [3, 4, 4, 3, 4, 2, 5, 4, 3, 4, 4, 4] }
  }
  return { hits: [3, 4, 4] }
}

export type MixSeries = {
  programme: number[]
  quickWorkout: number[]
  circuits: number[]
}

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0)
}

/** Dense ~100d athlete: most grains on, Sunday / every 5th off. */
export function pierreRhythmPresence(kind: ProfileWindowKind): boolean[] {
  const n = MIX_CATEGORIES[kind].length
  if (kind === "7") {
    return [true, true, true, true, true, true, false]
  }
  return Array.from({ length: n }, (_, i) => i % 5 !== 4)
}

/** Session counts per type. Several patterns stack 2–3 types on one tick. */
const MIX_DAY_PATTERNS = [
  { programme: 1, quickWorkout: 0, circuits: 1 },
  { programme: 1, quickWorkout: 0, circuits: 0 },
  { programme: 2, quickWorkout: 1, circuits: 0 },
  { programme: 0, quickWorkout: 1, circuits: 0 },
  { programme: 1, quickWorkout: 1, circuits: 1 },
] as const

function mixDayPattern(filledIndex: number): {
  programme: number
  quickWorkout: number
  circuits: number
} {
  const pattern = MIX_DAY_PATTERNS[filledIndex % MIX_DAY_PATTERNS.length]
  if (pattern === undefined) {
    return { programme: 0, quickWorkout: 0, circuits: 0 }
  }
  return pattern
}

export function pierreMixSeries(kind: ProfileWindowKind): MixSeries {
  const presence = pierreRhythmPresence(kind)
  const rankByIndex = new Map(
    presence
      .map((on, i) => ({ on, i }))
      .filter(({ on }) => on)
      .map(({ i }, j) => [i, j]),
  )

  const tick = (i: number) => {
    const rank = rankByIndex.get(i)
    if (rank === undefined) {
      return { programme: 0, quickWorkout: 0, circuits: 0 }
    }
    return mixDayPattern(rank)
  }

  const ticks = presence.map((_, i) => tick(i))

  return {
    programme: ticks.map((t) => t.programme),
    quickWorkout: ticks.map((t) => t.quickWorkout),
    circuits: ticks.map((t) => t.circuits),
  }
}

export function emptyMixSeries(kind: ProfileWindowKind): MixSeries {
  const n = MIX_CATEGORIES[kind].length
  return {
    programme: zeros(n),
    quickWorkout: zeros(n),
    circuits: zeros(n),
  }
}

export function pierreRecordsSeries(kind: ProfileWindowKind): {
  prs: number[]
  rir0: (number | null)[]
} {
  const n = MIX_CATEGORIES[kind].length
  const prs = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 2 : i % 2 === 0 ? 1 : 0))
  const rir0 = Array.from({ length: n }, (_, i) => (i % 4 === 3 ? null : 12 + i * 3))
  return { prs, rir0 }
}

export type RecordsPulseFixture = {
  prs: number
  prsDelta: number
  exercises: number
  exercisesDelta: number
  sinceLast: string
  sinceDelta: number
  sinceDeltaN: string
}

export function pierreRecordsPulse(kind: ProfileWindowKind): RecordsPulseFixture {
  const byKind: Record<ProfileWindowKind, RecordsPulseFixture> = {
    "7": {
      prs: 11,
      prsDelta: 3,
      exercises: 8,
      exercisesDelta: 2,
      sinceLast: "2d",
      sinceDelta: 3,
      sinceDeltaN: "3d",
    },
    "30": {
      prs: 28,
      prsDelta: 5,
      exercises: 14,
      exercisesDelta: 2,
      sinceLast: "2d",
      sinceDelta: 1,
      sinceDeltaN: "1d",
    },
    "100": {
      prs: 61,
      prsDelta: 8,
      exercises: 19,
      exercisesDelta: 3,
      sinceLast: "2d",
      sinceDelta: 4,
      sinceDeltaN: "4d",
    },
    "365": {
      prs: 94,
      prsDelta: 12,
      exercises: 22,
      exercisesDelta: 1,
      sinceLast: "2d",
      sinceDelta: -2,
      sinceDeltaN: "2d",
    },
    all: {
      prs: 140,
      prsDelta: 0,
      exercises: 24,
      exercisesDelta: 0,
      sinceLast: "2d",
      sinceDelta: 0,
      sinceDeltaN: "",
    },
  }
  return byKind[kind]
}

export type PulseFixture = {
  sessions: number
  sessionDelta: number
  timeUnderBar: string
  timeDeltaN: string
  timeDelta: number
  avgMinutes: number
}

export function pierrePulse(kind: ProfileWindowKind): PulseFixture {
  const byKind: Record<ProfileWindowKind, PulseFixture> = {
    "7": {
      sessions: 5,
      sessionDelta: 1,
      timeUnderBar: "3h 20",
      timeDeltaN: "40 min",
      timeDelta: -40,
      avgMinutes: 40,
    },
    "30": {
      sessions: 18,
      sessionDelta: 3,
      timeUnderBar: "12h 10",
      timeDeltaN: "1h 20",
      timeDelta: 80,
      avgMinutes: 41,
    },
    "100": {
      sessions: 52,
      sessionDelta: 4,
      timeUnderBar: "36h",
      timeDeltaN: "2h",
      timeDelta: 120,
      avgMinutes: 42,
    },
    "365": {
      sessions: 148,
      sessionDelta: 12,
      timeUnderBar: "98h",
      timeDeltaN: "8h",
      timeDelta: 480,
      avgMinutes: 40,
    },
    all: {
      sessions: 312,
      sessionDelta: 0,
      timeUnderBar: "210h",
      timeDeltaN: "",
      timeDelta: 0,
      avgMinutes: 41,
    },
  }
  return byKind[kind]
}


export type CircuitsPulseFixture = {
  runs: number
  runsDelta: number
  distinct: number
  distinctDelta: number
  pbs: number
  pbsDelta: number
}

export function pierreCircuitsPulse(kind: ProfileWindowKind): CircuitsPulseFixture {
  const byKind: Record<ProfileWindowKind, CircuitsPulseFixture> = {
    "7": {
      runs: 11,
      runsDelta: 4,
      distinct: 3,
      distinctDelta: 0,
      pbs: 1,
      pbsDelta: 0,
    },
    "30": {
      runs: 24,
      runsDelta: 6,
      distinct: 3,
      distinctDelta: 0,
      pbs: 2,
      pbsDelta: 1,
    },
    "100": {
      runs: 41,
      runsDelta: 7,
      distinct: 3,
      distinctDelta: 1,
      pbs: 3,
      pbsDelta: 1,
    },
    "365": {
      runs: 68,
      runsDelta: 9,
      distinct: 4,
      distinctDelta: 1,
      pbs: 5,
      pbsDelta: 2,
    },
    all: {
      runs: 88,
      runsDelta: 0,
      distinct: 4,
      distinctDelta: 0,
      pbs: 6,
      pbsDelta: 0,
    },
  }
  return byKind[kind]
}

export type CircuitAmrapRunFixture = {
  fullRounds: number
  leftover: number
  leftoverName: string
}

export type CircuitToursRunFixture = {
  seconds: number
}

export type CircuitRowFixture =
  | {
      mode: "amrap"
      name: string
      minutes: number
      pb: boolean
      runCount: number
      runs: readonly CircuitAmrapRunFixture[]
    }
  | {
      mode: "rounds"
      name: string
      rounds: number
      pb: boolean
      runCount: number
      runs: readonly CircuitToursRunFixture[]
    }

export function circuitSparkValues(row: CircuitRowFixture): readonly number[] {
  return row.mode === "amrap"
    ? row.runs.map((run) => run.fullRounds)
    : row.runs.map((run) => run.seconds)
}

function amrapBeats(
  candidate: CircuitAmrapRunFixture,
  best: CircuitAmrapRunFixture,
): boolean {
  if (candidate.fullRounds !== best.fullRounds) {
    return candidate.fullRounds > best.fullRounds
  }
  return candidate.leftover > best.leftover
}

export function circuitBestAmrap(
  runs: readonly CircuitAmrapRunFixture[],
): CircuitAmrapRunFixture | undefined {
  const [first, ...rest] = runs
  if (first == null) return undefined
  return rest.reduce((best, run) => (amrapBeats(run, best) ? run : best), first)
}

export function circuitBestTours(
  runs: readonly CircuitToursRunFixture[],
): CircuitToursRunFixture | undefined {
  const [first, ...rest] = runs
  if (first == null) return undefined
  return rest.reduce(
    (best, run) => (run.seconds < best.seconds ? run : best),
    first,
  )
}

const PIERRE_CIRCUIT_RUNS: Record<
  ProfileWindowKind,
  readonly [number, number, number]
> = {
  "7": [5, 3, 3],
  "30": [12, 7, 5],
  "100": [22, 11, 8],
  "365": [32, 20, 16],
  all: [40, 28, 20],
}

export const PIERRE_CIRCUITS: readonly CircuitRowFixture[] = [
  {
    mode: "amrap",
    name: "Cindy",
    minutes: 20,
    pb: true,
    runCount: 22,
    runs: [
      { fullRounds: 8, leftover: 2, leftoverName: "pull-ups" },
      { fullRounds: 10, leftover: 1, leftoverName: "pull-ups" },
      { fullRounds: 9, leftover: 0, leftoverName: "pull-ups" },
    ],
  },
  {
    mode: "amrap",
    name: "Athena",
    minutes: 12,
    pb: false,
    runCount: 11,
    runs: [
      { fullRounds: 4, leftover: 6, leftoverName: "sit-ups" },
      { fullRounds: 5, leftover: 4, leftoverName: "sit-ups" },
      { fullRounds: 5, leftover: 1, leftoverName: "sit-ups" },
    ],
  },
  {
    mode: "rounds",
    name: "Force",
    rounds: 4,
    pb: false,
    runCount: 8,
    runs: [{ seconds: 520 }, { seconds: 478 }, { seconds: 498 }],
  },
]

export function pierreCircuits(kind: ProfileWindowKind): CircuitRowFixture[] {
  const counts = PIERRE_CIRCUIT_RUNS[kind]
  return PIERRE_CIRCUITS.map((row, i) => ({
    ...row,
    runCount: counts[i] ?? row.runCount,
  }))
}

const BADGE_ICON_BASE =
  "https://favusepjqwpcroiolvaz.supabase.co/storage/v1/object/public/badge-icons"

function badgeIconUrl(groupSlug: string, rank: string): string {
  return `${BADGE_ICON_BASE}/${groupSlug}_${rank}.webp`
}

function pierreBadge(
  row: Pick<
    BadgeStatusRow,
    | "group_slug"
    | "group_name_en"
    | "group_name_fr"
    | "rank"
    | "title_en"
    | "title_fr"
    | "tier_level"
    | "threshold_value"
    | "granted_at"
  >,
): BadgeStatusRow {
  return {
    ...row,
    group_id: row.group_slug,
    tier_id: `${row.group_slug}-${row.rank}`,
    icon_asset_url: badgeIconUrl(row.group_slug, row.rank),
    is_unlocked: true,
    current_value: row.threshold_value,
    progress_pct: 100,
  }
}

const CIRCUIT_RUNNER = {
  group_slug: "circuit_runner",
  group_name_en: "Circuit Runner",
  group_name_fr: "Circuit runner",
} as const

export const PIERRE_SUCCES = {
  unlocked: 12,
  total: 40,
  latest: pierreBadge({
    ...CIRCUIT_RUNNER,
    rank: "gold",
    title_en: "No Break",
    title_fr: "Sans relâche",
    tier_level: 3,
    threshold_value: 15,
    granted_at: "2026-08-18",
  }),
  highest: pierreBadge({
    ...CIRCUIT_RUNNER,
    rank: "diamond",
    title_en: "Circuit Star",
    title_fr: "Star des circuits",
    tier_level: 5,
    threshold_value: 100,
    granted_at: "2026-06-01",
  }),
  recent: [
    pierreBadge({
      group_slug: "spidey",
      group_name_en: "Spidey",
      group_name_fr: "L'Araignée",
      rank: "bronze",
      title_en: "Baby Spidey",
      title_fr: "Baby Spidey",
      tier_level: 1,
      threshold_value: 1,
      granted_at: "2026-08-10",
    }),
    pierreBadge({
      ...CIRCUIT_RUNNER,
      rank: "bronze",
      title_en: "First Lap",
      title_fr: "Premier tour",
      tier_level: 1,
      threshold_value: 1,
      granted_at: "2026-08-04",
    }),
    pierreBadge({
      group_slug: "push_ups",
      group_name_en: "Push-ups",
      group_name_fr: "Pompes",
      rank: "bronze",
      title_en: "Nose to Floor",
      title_fr: "Nez au sol",
      tier_level: 1,
      threshold_value: 100,
      granted_at: "2026-08-01",
    }),
  ],
}
