import { pierreRhythmPresence, type ProfileWindowKind } from "./window"

const SESSION_TONNES = [3.2, 3.8, 2.1, 4.5, 4] as const
const CIRCUIT_STATION_TONNES = 0.8
const TONNAGE_SCALE: Record<ProfileWindowKind, number> = {
  "7": 1,
  "30": 5,
  "100": 8,
  "365": 12,
  all: 40,
}

function loadedTonnesForSession(filledIndex: number): number {
  if (filledIndex % 4 === 3) return CIRCUIT_STATION_TONNES
  const loadedIndex = filledIndex - Math.floor(filledIndex / 4)
  return SESSION_TONNES[loadedIndex % SESSION_TONNES.length] ?? 0
}

/** Loaded-set kg×reps in tonnes. Circuit days keep a small loaded station; rest = 0. */
export function pierreTonnageBars(kind: ProfileWindowKind): number[] {
  const presence = pierreRhythmPresence(kind)
  const filled = presence
    .map((on, i) => ({ on, i }))
    .filter(({ on }) => on)
  const tonnesByIdx = new Map(
    filled.map(({ i }, j) => [i, loadedTonnesForSession(j) * TONNAGE_SCALE[kind]] as const),
  )
  return presence.map((_, i) => tonnesByIdx.get(i) ?? 0)
}
