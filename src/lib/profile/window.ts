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

export function pierreMixSeries(kind: ProfileWindowKind): MixSeries {
  const presence = pierreRhythmPresence(kind)
  const programme = zeros(presence.length)
  const quickWorkout = zeros(presence.length)
  const circuits = zeros(presence.length)

  const filled = presence
    .map((on, i) => ({ on, i }))
    .filter(({ on }) => on)

  const stacked = filled.map(({ i }, j) => {
    const slot = j % 4
    return { i, slot }
  })

  stacked.forEach(({ i, slot }) => {
    if (slot === 0 || slot === 1) programme[i] = 1
    else if (slot === 2) quickWorkout[i] = 1
    else circuits[i] = 1
  })

  return { programme, quickWorkout, circuits }
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

export type PulseFixture = {
  sessions: number
  sessionDelta: number
  timeUnderBar: string
  timeDeltaN: string
  avgMinutes: number
}

export function pierrePulse(kind: ProfileWindowKind): PulseFixture {
  const byKind: Record<ProfileWindowKind, PulseFixture> = {
    "7": {
      sessions: 5,
      sessionDelta: 1,
      timeUnderBar: "3h 20",
      timeDeltaN: "40 min",
      avgMinutes: 40,
    },
    "30": {
      sessions: 18,
      sessionDelta: 3,
      timeUnderBar: "12h 10",
      timeDeltaN: "1h 20",
      avgMinutes: 41,
    },
    "100": {
      sessions: 52,
      sessionDelta: 4,
      timeUnderBar: "36h",
      timeDeltaN: "2h",
      avgMinutes: 42,
    },
    "365": {
      sessions: 148,
      sessionDelta: 12,
      timeUnderBar: "98h",
      timeDeltaN: "8h",
      avgMinutes: 40,
    },
    all: {
      sessions: 312,
      sessionDelta: 0,
      timeUnderBar: "210h",
      timeDeltaN: "",
      avgMinutes: 41,
    },
  }
  return byKind[kind]
}


export const PIERRE_CIRCUITS = [
  { name: "Cindy", mode: "AMRAP 20", scores: "8+2 · 9+0 · 10+1", pb: true },
  { name: "Athena", mode: "AMRAP 12", scores: "4+6 · 5+1 · 5+4", pb: false },
] as const

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
