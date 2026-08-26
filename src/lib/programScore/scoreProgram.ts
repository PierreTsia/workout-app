import { MUSCLE_TAXONOMY, computeBalanceScore } from "@/lib/trainingBalance"
import type { MuscleTaxonomy } from "@/lib/trainingBalance"
import type { ExerciseBlockMode } from "@/types/database"
import {
  ENDURANCE_CIRCUITS_HIGH,
  ENDURANCE_CIRCUITS_OK,
  ENDURANCE_DENSE_REPS_MIN,
  ENDURANCE_DENSE_REST_MAX_SECONDS,
  ENDURANCE_DENSE_SHARE,
  EQUIPMENT_BODYWEIGHT,
  EQUIPMENT_FREE,
  EQUIPMENT_MACHINE,
  HYPERTROPHY_FREQUENCY_MAX,
  HYPERTROPHY_FREQUENCY_MIN,
  HYPERTROPHY_ROLLUP_OK,
  HYPERTROPHY_ROLLUP_SHORT,
  HYPERTROPHY_VOLUME_MAX,
  HYPERTROPHY_VOLUME_MIN,
  STRENGTH_REP_MAX,
  STRENGTH_REST_MIN_SECONDS,
  STRENGTH_SHARE_OK,
  STRENGTH_SHARE_SHORT,
} from "./bands"
import type {
  EquipmentMixBucket,
  IntentCircuit,
  IntentSolo,
  IntentStation,
  ProgramFacts,
  ProgramIntent,
  ProgramIntentDay,
  ProgramScore,
  ScoreBand,
} from "./types"

const TAXONOMY = new Set<string>(MUSCLE_TAXONOMY)
const FREE = new Set<string>(EQUIPMENT_FREE)
const MACHINE = new Set<string>(EQUIPMENT_MACHINE)
const BODYWEIGHT = new Set<string>(EQUIPMENT_BODYWEIGHT)

function isTaxonomy(value: string): value is MuscleTaxonomy {
  return TAXONOMY.has(value)
}

function knownMuscle(slug: string | null): MuscleTaxonomy | null {
  if (slug == null) return null
  return isTaxonomy(slug) ? slug : null
}

function emptyFacts(dayCount: number): ProgramFacts {
  return {
    dayCount,
    setCount: 0,
    circuitCount: 0,
    circuitModes: { amrap: 0, rounds: 0 },
    mix: { free: 0, machine: 0, bodyweight: 0, other: 0 },
  }
}

function emptyScore(dayCount: number): ProgramScore {
  return {
    hypertrophy: { band: "empty", volume: "empty", frequency: "empty" },
    strength: { band: "empty" },
    endurance: { band: "empty" },
    balance: { kind: "empty" },
    facts: emptyFacts(dayCount),
  }
}

function hasItems(days: readonly ProgramIntentDay[]): boolean {
  return days.some((day) => day.solos.length > 0 || day.circuits.length > 0)
}

function mixBucket(equipment: string): EquipmentMixBucket {
  if (FREE.has(equipment)) return "free"
  if (MACHINE.has(equipment)) return "machine"
  if (BODYWEIGHT.has(equipment)) return "bodyweight"
  return "other"
}

function muscleCredits(
  primaryMuscle: string | null,
  secondaryMuscles: readonly string[],
  primaryCredit: number,
  secondaryCredit: number,
): ReadonlyArray<{ muscle: MuscleTaxonomy; credit: number }> {
  const primary = knownMuscle(primaryMuscle)
  const secondaries = secondaryMuscles
    .map(knownMuscle)
    .filter((muscle): muscle is MuscleTaxonomy => muscle != null)

  const primaryRow =
    primary == null ? [] : [{ muscle: primary, credit: primaryCredit }]
  const secondaryRows = secondaries.map((muscle) => ({
    muscle,
    credit: secondaryCredit,
  }))
  return [...primaryRow, ...secondaryRows]
}

function soloMuscleCredits(
  solo: IntentSolo,
): ReadonlyArray<{ muscle: MuscleTaxonomy; credit: number }> {
  return muscleCredits(solo.primaryMuscle, solo.secondaryMuscles, solo.sets, solo.sets * 0.5)
}

function stationPresenceCredits(
  station: IntentStation,
): ReadonlyArray<{ muscle: MuscleTaxonomy; credit: number }> {
  return muscleCredits(station.primaryMuscle, station.secondaryMuscles, 1, 0.5)
}

function rollupBand(share: number): ScoreBand {
  if (share < HYPERTROPHY_ROLLUP_SHORT) return "short"
  if (share < HYPERTROPHY_ROLLUP_OK) return "ok"
  return "high"
}

function inVolumeBand(sets: number): boolean {
  return sets >= HYPERTROPHY_VOLUME_MIN && sets <= HYPERTROPHY_VOLUME_MAX
}

function inFrequencyBand(days: number): boolean {
  return days >= HYPERTROPHY_FREQUENCY_MIN && days <= HYPERTROPHY_FREQUENCY_MAX
}

function addMix(
  mix: ProgramFacts["mix"],
  equipment: string,
  credit: number,
): ProgramFacts["mix"] {
  const bucket = mixBucket(equipment)
  return { ...mix, [bucket]: mix[bucket] + credit }
}

function addNumber(
  map: ReadonlyMap<MuscleTaxonomy, number>,
  muscle: MuscleTaxonomy,
  credit: number,
): Map<MuscleTaxonomy, number> {
  return new Map(map).set(muscle, (map.get(muscle) ?? 0) + credit)
}

function addDay(
  map: ReadonlyMap<MuscleTaxonomy, ReadonlySet<string>>,
  muscle: MuscleTaxonomy,
  dayId: string,
): ReadonlyMap<MuscleTaxonomy, ReadonlySet<string>> {
  const next = new Set(map.get(muscle) ?? [])
  next.add(dayId)
  return new Map(map).set(muscle, next)
}

type WeekAcc = {
  volumeByMuscle: ReadonlyMap<MuscleTaxonomy, number>
  daysByMuscle: ReadonlyMap<MuscleTaxonomy, ReadonlySet<string>>
  balanceByMuscle: ReadonlyMap<MuscleTaxonomy, number>
  setCount: number
  strengthSets: number
  denseSets: number
  circuitCount: number
  circuitModes: Readonly<Record<ExerciseBlockMode, number>>
  mix: ProgramFacts["mix"]
}

function emptyAcc(): WeekAcc {
  return {
    volumeByMuscle: new Map(),
    daysByMuscle: new Map(),
    balanceByMuscle: new Map(MUSCLE_TAXONOMY.map((muscle) => [muscle, 0])),
    setCount: 0,
    strengthSets: 0,
    denseSets: 0,
    circuitCount: 0,
    circuitModes: { amrap: 0, rounds: 0 },
    mix: emptyFacts(0).mix,
  }
}

function isStrengthSolo(solo: IntentSolo): boolean {
  if (solo.measurementType === "duration") return false
  if (solo.repMax == null) return false
  return (
    solo.repMax <= STRENGTH_REP_MAX &&
    solo.restSeconds >= STRENGTH_REST_MIN_SECONDS
  )
}

function isDenseSolo(solo: IntentSolo): boolean {
  if (solo.restSeconds > ENDURANCE_DENSE_REST_MAX_SECONDS) return false
  return (
    solo.measurementType === "duration" ||
    (solo.repMax != null && solo.repMax >= ENDURANCE_DENSE_REPS_MIN)
  )
}

function accumulateSolo(acc: WeekAcc, dayId: string, solo: IntentSolo): WeekAcc {
  const credits = soloMuscleCredits(solo)
  const withMuscles = credits.reduce(
    (next, { muscle, credit }) => ({
      volumeByMuscle: addNumber(next.volumeByMuscle, muscle, credit),
      daysByMuscle: addDay(next.daysByMuscle, muscle, dayId),
      balanceByMuscle: addNumber(next.balanceByMuscle, muscle, credit),
    }),
    {
      volumeByMuscle: acc.volumeByMuscle,
      daysByMuscle: acc.daysByMuscle,
      balanceByMuscle: acc.balanceByMuscle,
    },
  )

  return {
    ...acc,
    ...withMuscles,
    setCount: acc.setCount + solo.sets,
    strengthSets: acc.strengthSets + (isStrengthSolo(solo) ? solo.sets : 0),
    denseSets: acc.denseSets + (isDenseSolo(solo) ? solo.sets : 0),
    mix: addMix(acc.mix, solo.equipment, solo.sets),
  }
}

function accumulateStation(
  acc: WeekAcc,
  dayId: string,
  station: IntentStation,
): WeekAcc {
  const credits = stationPresenceCredits(station)
  const withMuscles = credits.reduce(
    (next, { muscle, credit }) => ({
      daysByMuscle: addDay(next.daysByMuscle, muscle, dayId),
      balanceByMuscle: addNumber(next.balanceByMuscle, muscle, credit),
    }),
    {
      daysByMuscle: acc.daysByMuscle,
      balanceByMuscle: acc.balanceByMuscle,
    },
  )

  return {
    ...acc,
    daysByMuscle: withMuscles.daysByMuscle,
    balanceByMuscle: withMuscles.balanceByMuscle,
    mix: addMix(acc.mix, station.equipment, 1),
  }
}

function accumulateCircuit(
  acc: WeekAcc,
  dayId: string,
  circuit: IntentCircuit,
): WeekAcc {
  const withStations = circuit.stations.reduce(
    (next, station) => accumulateStation(next, dayId, station),
    acc,
  )

  return {
    ...withStations,
    circuitCount: acc.circuitCount + 1,
    circuitModes: {
      ...acc.circuitModes,
      [circuit.mode]: acc.circuitModes[circuit.mode] + 1,
    },
  }
}

function foldWeek(intent: ProgramIntent): WeekAcc {
  return intent.days.reduce((week, day) => {
    const afterSolos = day.solos.reduce(
      (next, solo) => accumulateSolo(next, day.id, solo),
      week,
    )
    return day.circuits.reduce(
      (next, circuit) => accumulateCircuit(next, day.id, circuit),
      afterSolos,
    )
  }, emptyAcc())
}

/** Same 13-axis credits as Program Balance (solos 1 / 0.5, Circuit presence once). */
export function intentBalanceCredits(
  intent: ProgramIntent,
): ReadonlyMap<MuscleTaxonomy, number> {
  return foldWeek(intent).balanceByMuscle
}

function scoreHypertrophy(
  volumeByMuscle: ReadonlyMap<MuscleTaxonomy, number>,
  daysByMuscle: ReadonlyMap<MuscleTaxonomy, ReadonlySet<string>>,
): ProgramScore["hypertrophy"] {
  const volumeMuscles = MUSCLE_TAXONOMY.filter(
    (muscle) => (volumeByMuscle.get(muscle) ?? 0) > 0,
  )
  const frequencyMuscles = MUSCLE_TAXONOMY.filter(
    (muscle) => (daysByMuscle.get(muscle)?.size ?? 0) > 0,
  )

  const shareOf = (
    muscles: readonly MuscleTaxonomy[],
    predicate: (muscle: MuscleTaxonomy) => boolean,
  ): ScoreBand =>
    muscles.length === 0
      ? "empty"
      : rollupBand(muscles.filter(predicate).length / muscles.length)

  return {
    band:
      volumeMuscles.length === 0
        ? "empty"
        : rollupBand(
            volumeMuscles.filter(
              (muscle) =>
                inVolumeBand(volumeByMuscle.get(muscle) ?? 0) &&
                inFrequencyBand(daysByMuscle.get(muscle)?.size ?? 0),
            ).length / volumeMuscles.length,
          ),
    volume: shareOf(volumeMuscles, (muscle) =>
      inVolumeBand(volumeByMuscle.get(muscle) ?? 0),
    ),
    frequency: shareOf(frequencyMuscles, (muscle) =>
      inFrequencyBand(daysByMuscle.get(muscle)?.size ?? 0),
    ),
  }
}

function scoreStrength(setCount: number, strengthSets: number): ScoreBand {
  if (setCount === 0) return "empty"
  const share = strengthSets / setCount
  if (share < STRENGTH_SHARE_SHORT) return "short"
  if (share < STRENGTH_SHARE_OK) return "ok"
  return "high"
}

function scoreEndurance(circuitCount: number, setCount: number, denseSets: number): ScoreBand {
  const denseShare = setCount === 0 ? 0 : denseSets / setCount
  if (circuitCount === 0 && denseShare < ENDURANCE_DENSE_SHARE) return "short"
  if (
    circuitCount >= ENDURANCE_CIRCUITS_HIGH ||
    (circuitCount >= ENDURANCE_CIRCUITS_OK && denseShare >= ENDURANCE_DENSE_SHARE)
  ) {
    return "high"
  }
  return "ok"
}

export function scoreProgram(intent: ProgramIntent): ProgramScore {
  if (!hasItems(intent.days)) {
    return emptyScore(intent.days.length)
  }

  const acc = foldWeek(intent)

  const balanceVector = MUSCLE_TAXONOMY.map(
    (muscle) => acc.balanceByMuscle.get(muscle) ?? 0,
  )

  return {
    hypertrophy: scoreHypertrophy(acc.volumeByMuscle, acc.daysByMuscle),
    strength: { band: scoreStrength(acc.setCount, acc.strengthSets) },
    endurance: {
      band: scoreEndurance(acc.circuitCount, acc.setCount, acc.denseSets),
    },
    balance: { kind: "score", value: computeBalanceScore(balanceVector) },
    facts: {
      dayCount: intent.days.length,
      setCount: acc.setCount,
      circuitCount: acc.circuitCount,
      circuitModes: acc.circuitModes,
      mix: acc.mix,
    },
  }
}
