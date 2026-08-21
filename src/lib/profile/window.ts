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

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0)
}

function oneAt(n: number, index: number): number[] {
  return zeros(n).map((v, i) => (i === index ? 1 : v))
}

export function pierreMixSeries(kind: ProfileWindowKind): {
  programme: number[]
  quickWorkout: number[]
  circuits: number[]
} {
  const n = MIX_CATEGORIES[kind].length
  const circuitIdx = Math.min(4, n - 1)
  return {
    programme: zeros(n),
    quickWorkout: zeros(n),
    circuits: oneAt(n, circuitIdx),
  }
}

export function emptyMixSeries(kind: ProfileWindowKind): {
  programme: number[]
  quickWorkout: number[]
  circuits: number[]
} {
  const n = MIX_CATEGORIES[kind].length
  return {
    programme: zeros(n),
    quickWorkout: zeros(n),
    circuits: zeros(n),
  }
}

export function pierreRhythmPresence(kind: ProfileWindowKind): boolean[] {
  const n = MIX_CATEGORIES[kind].length
  return Array.from({ length: n }, (_, i) => i === Math.min(4, n - 1))
}
