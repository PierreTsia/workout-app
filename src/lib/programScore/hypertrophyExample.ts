import {
  HYPERTROPHY_FREQUENCY_MAX,
  HYPERTROPHY_FREQUENCY_MIN,
  HYPERTROPHY_VOLUME_MAX,
  HYPERTROPHY_VOLUME_MIN,
} from "@/lib/programScore/bands"
import type { ProgramIntent, ProgramScore, ScoreBand } from "@/lib/programScore/types"

export type HypertrophyExample = {
  muscle: string
  sets: number
  days: number
  band: Exclude<ScoreBand, "empty">
}

export type ProgramIntentScore = ProgramScore & {
  hypertrophyExample?: HypertrophyExample | null
}

type MuscleAcc = {
  volumeByMuscle: Readonly<Record<string, number>>
  daysByMuscle: Readonly<Record<string, readonly string[]>>
}

function bandForMuscle(sets: number, days: number): Exclude<ScoreBand, "empty"> {
  const volumeOk = sets >= HYPERTROPHY_VOLUME_MIN && sets <= HYPERTROPHY_VOLUME_MAX
  const frequencyOk =
    days >= HYPERTROPHY_FREQUENCY_MIN && days <= HYPERTROPHY_FREQUENCY_MAX
  if (volumeOk && frequencyOk) return "ok"
  if (sets > HYPERTROPHY_VOLUME_MAX || days > HYPERTROPHY_FREQUENCY_MAX) return "high"
  return "short"
}

function addDay(
  days: Readonly<Record<string, readonly string[]>>,
  muscle: string,
  dayId: string,
): Readonly<Record<string, readonly string[]>> {
  const current = days[muscle] ?? []
  if (current.includes(dayId)) return days
  return { ...days, [muscle]: [...current, dayId] }
}

export function hypertrophyWorkedExample(
  intent: ProgramIntent,
): HypertrophyExample | null {
  const acc = intent.days.reduce<MuscleAcc>(
    (week, day) => {
      const afterSolos = day.solos.reduce<MuscleAcc>((next, solo) => {
        const muscle = solo.primaryMuscle
        if (muscle == null) return next
        return {
          volumeByMuscle: {
            ...next.volumeByMuscle,
            [muscle]: (next.volumeByMuscle[muscle] ?? 0) + solo.sets,
          },
          daysByMuscle: addDay(next.daysByMuscle, muscle, day.id),
        }
      }, week)

      return day.circuits.reduce<MuscleAcc>(
        (next, circuit) =>
          circuit.stations.reduce<MuscleAcc>((stationAcc, station) => {
            const muscle = station.primaryMuscle
            if (muscle == null) return stationAcc
            return {
              ...stationAcc,
              daysByMuscle: addDay(stationAcc.daysByMuscle, muscle, day.id),
            }
          }, next),
        afterSolos,
      )
    },
    { volumeByMuscle: {}, daysByMuscle: {} },
  )

  const muscle =
    Object.keys(acc.volumeByMuscle)[0] ?? Object.keys(acc.daysByMuscle)[0]
  if (muscle == null) return null

  const sets = acc.volumeByMuscle[muscle] ?? 0
  const days = acc.daysByMuscle[muscle]?.length ?? 0
  return { muscle, sets, days, band: bandForMuscle(sets, days) }
}
