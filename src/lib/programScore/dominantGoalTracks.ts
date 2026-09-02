import type { ProgramScore, ScoreBand } from "@/lib/programScore/types"

export const GOAL_TRACKS = ["hypertrophy", "strength", "endurance"] as const

export type GoalTrack = (typeof GOAL_TRACKS)[number]

const BAND_RANK: Record<ScoreBand, number> = {
  empty: 0,
  short: 1,
  ok: 2,
  high: 3,
}

/** Highest non-empty Goal Track band(s). Ties keep hypertrophy → strength → endurance order. */
export function dominantGoalTracks(score: ProgramScore): readonly GoalTrack[] {
  const ranked = GOAL_TRACKS.map((track) => ({
    track,
    rank: BAND_RANK[score[track].band],
  })).filter(({ rank }) => rank > 0)

  if (ranked.length === 0) return []

  const top = Math.max(...ranked.map(({ rank }) => rank))
  return ranked.filter(({ rank }) => rank === top).map(({ track }) => track)
}

export function joinTrackNames(names: readonly string[]): string {
  if (names.length <= 2) return names.join(" + ")
  return `${names.slice(0, -1).join(", ")} + ${names[names.length - 1]}`
}
