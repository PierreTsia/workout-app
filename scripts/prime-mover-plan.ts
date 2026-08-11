/**
 * Pure plan for the Prime Mover (Echo) Tour seed — no I/O.
 * Session cadence + last-session shapes that drive progression pills.
 */

export const PRIME_MOVER_USER_ID_DEFAULT = "afce3616-7d7a-4851-9ed4-09f2c0ec4323"
export const PROGRAM_NAME = "Echo Strength — 3×"
export const SESSION_PREFIX = "Prime Mover"

/** Catalog `exercises.name` values known to exist on hosted workout-app. */
export const EXERCISE_NAMES = {
  bench: "Développé couché",
  ohp: "Développé épaules haltères",
  laterals: "Élévations latérales",
  triceps: "Extension triceps corde",
  pulldown: "Tirage poulie haute prise large",
  row: "Rowing haltère",
  curls: "Curls stricts barre",
  pullups: "Tractions",
  squat: "Squat barre",
  rdl: "Soulevé de terre roumain",
  legPress: "Presse à cuisse",
  legCurl: "Leg Curl assis",
  hipThrust: "Hip Thrust",
} as const

export type DayKey = "push" | "pull" | "legs"

export type SlotTemplate = {
  exerciseName: string
  sets: number
  reps: number
  repRangeMin: number
  repRangeMax: number
  setRangeMin: number
  setRangeMax: number
  /** Template / prescribed working weight (kg). */
  weight: number
  weightIncrement: number
  restSeconds: number
  /** When true, last completed cycle should yield PLATEAU. */
  maxWeightReached?: boolean
}

export type SetOutcome = {
  reps: number
  weight: number
  rir: number | null
  was_pr?: boolean
}

export type PlannedSession = {
  daysAgo: number
  dayKey: DayKey
  label: string
  startHourUTC: number
  durationMin: number
  /** Per-slot outcomes in day slot order. */
  slots: SetOutcome[][]
  /** Mark the last session of each day for progression staging. */
  progressionTag?: "weight_up" | "hold" | "plateau"
}

export const DAY_LABELS: Record<DayKey, { label: string; emoji: string; sort_order: number }> = {
  push: { label: "Push", emoji: "💪", sort_order: 0 },
  pull: { label: "Pull", emoji: "🧲", sort_order: 1 },
  legs: { label: "Legs", emoji: "🦵", sort_order: 2 },
}

export const DAY_SLOTS: Record<DayKey, SlotTemplate[]> = {
  push: [
    {
      exerciseName: EXERCISE_NAMES.bench,
      sets: 3,
      reps: 8,
      repRangeMin: 6,
      repRangeMax: 10,
      setRangeMin: 2,
      setRangeMax: 5,
      weight: 72.5,
      weightIncrement: 2.5,
      restSeconds: 150,
    },
    {
      exerciseName: EXERCISE_NAMES.ohp,
      sets: 3,
      reps: 8,
      repRangeMin: 6,
      repRangeMax: 10,
      setRangeMin: 2,
      setRangeMax: 4,
      weight: 28,
      weightIncrement: 2,
      restSeconds: 120,
    },
    {
      exerciseName: EXERCISE_NAMES.laterals,
      sets: 3,
      reps: 12,
      repRangeMin: 10,
      repRangeMax: 15,
      setRangeMin: 2,
      setRangeMax: 4,
      weight: 10,
      weightIncrement: 2,
      restSeconds: 75,
    },
    {
      exerciseName: EXERCISE_NAMES.triceps,
      sets: 3,
      reps: 12,
      repRangeMin: 10,
      repRangeMax: 15,
      setRangeMin: 2,
      setRangeMax: 4,
      weight: 27.5,
      weightIncrement: 2.5,
      restSeconds: 75,
    },
  ],
  pull: [
    {
      exerciseName: EXERCISE_NAMES.pulldown,
      sets: 3,
      reps: 8,
      repRangeMin: 6,
      repRangeMax: 10,
      setRangeMin: 2,
      setRangeMax: 5,
      weight: 55,
      weightIncrement: 2.5,
      restSeconds: 120,
    },
    {
      exerciseName: EXERCISE_NAMES.row,
      sets: 3,
      reps: 10,
      repRangeMin: 8,
      repRangeMax: 12,
      setRangeMin: 2,
      setRangeMax: 4,
      weight: 32,
      weightIncrement: 2,
      restSeconds: 105,
    },
    {
      exerciseName: EXERCISE_NAMES.curls,
      sets: 3,
      reps: 10,
      repRangeMin: 8,
      repRangeMax: 12,
      setRangeMin: 2,
      setRangeMax: 4,
      weight: 30,
      weightIncrement: 2.5,
      restSeconds: 75,
    },
    {
      exerciseName: EXERCISE_NAMES.pullups,
      sets: 3,
      reps: 6,
      repRangeMin: 4,
      repRangeMax: 8,
      setRangeMin: 2,
      setRangeMax: 5,
      weight: 0,
      weightIncrement: 2.5,
      restSeconds: 120,
    },
  ],
  legs: [
    {
      exerciseName: EXERCISE_NAMES.squat,
      sets: 3,
      reps: 5,
      repRangeMin: 3,
      repRangeMax: 5,
      setRangeMin: 3,
      setRangeMax: 3,
      weight: 100,
      weightIncrement: 2.5,
      restSeconds: 180,
      maxWeightReached: true,
    },
    {
      exerciseName: EXERCISE_NAMES.rdl,
      sets: 3,
      reps: 8,
      repRangeMin: 6,
      repRangeMax: 10,
      setRangeMin: 2,
      setRangeMax: 4,
      weight: 80,
      weightIncrement: 2.5,
      restSeconds: 150,
    },
    {
      exerciseName: EXERCISE_NAMES.legPress,
      sets: 3,
      reps: 10,
      repRangeMin: 8,
      repRangeMax: 12,
      setRangeMin: 2,
      setRangeMax: 4,
      weight: 140,
      weightIncrement: 5,
      restSeconds: 120,
    },
    {
      exerciseName: EXERCISE_NAMES.legCurl,
      sets: 3,
      reps: 12,
      repRangeMin: 10,
      repRangeMax: 15,
      setRangeMin: 2,
      setRangeMax: 4,
      weight: 40,
      weightIncrement: 2.5,
      restSeconds: 75,
    },
    {
      exerciseName: EXERCISE_NAMES.hipThrust,
      sets: 3,
      reps: 8,
      repRangeMin: 6,
      repRangeMax: 10,
      setRangeMin: 2,
      setRangeMax: 4,
      weight: 90,
      weightIncrement: 5,
      restSeconds: 120,
    },
  ],
}

function epley1rm(weight: number, reps: number): number | null {
  if (weight <= 0 || reps <= 0) return null
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

export function estimated1rm(weight: number, reps: number): number | null {
  return epley1rm(weight, reps)
}

/** Working sets that hit the top of the rep range with comfortable RIR → WEIGHT_UP. */
function weightUpSets(slot: SlotTemplate, week: number): SetOutcome[] {
  const bump = Math.floor(week / 2) * slot.weightIncrement
  const w = slot.weight - 5 + bump
  return Array.from({ length: slot.sets }, (_, i) => ({
    reps: slot.repRangeMax,
    weight: w,
    rir: 2 + (i === slot.sets - 1 ? 0 : 1),
    was_pr: week >= 4 && i === slot.sets - 1,
  }))
}

/** Comfortable intermediate week (mix). */
function solidSets(slot: SlotTemplate, week: number): SetOutcome[] {
  const bump = Math.floor(week / 2) * slot.weightIncrement
  const w = Math.max(0, slot.weight - 7.5 + bump)
  return Array.from({ length: slot.sets }, (_, i) => ({
    reps: slot.reps + (i === 0 ? 1 : 0),
    weight: w,
    rir: 2,
  }))
}

/** Incomplete / grinding → HOLD on next session. */
function holdSets(slot: SlotTemplate): SetOutcome[] {
  return [
    { reps: slot.reps, weight: slot.weight, rir: 1 },
    { reps: Math.max(1, slot.reps - 2), weight: slot.weight, rir: 0 },
    { reps: Math.max(1, slot.reps - 3), weight: slot.weight, rir: 0 },
  ].slice(0, slot.sets)
}

/** Hit max reps at ceiling weight with max_weight_reached on the slot → PLATEAU. */
function plateauSets(slot: SlotTemplate): SetOutcome[] {
  return Array.from({ length: slot.sets }, () => ({
    reps: slot.repRangeMax,
    weight: slot.weight,
    rir: 2,
  }))
}

/**
 * ~14 weeks of PPL for the Activity 100-day heatmap.
 * Newest week stages progression (Tour pills):
 *   Push → WEIGHT_UP (OHP — Tour lead; less cliché than bench)
 *   Pull → HOLD (pulldown grinding)
 *   Legs → PLATEAU (squat capped)
 *
 * Older weeks use a deterministic “human” calendar — skips, Tue/Thu
 * shifts, weekend make-ups, and uneven durations — so the heatmap
 * doesn’t read as three perfect cron stripes.
 */
/** Weeks of PPL history — spans most of the Activity 100-day heatmap. */
export const SEED_WEEK_COUNT = 14

/** Push slot index for WEIGHT_UP staging (1 = OHP, not bench). */
const PUSH_WEIGHT_UP_SLOT = 1

/**
 * Day-of-week offsets within a week (0 = same weekday as “today” / Push anchor).
 * `null` = skip that session (busy / travel week).
 */
type WeekOffsets = Record<DayKey, number | null>

/** Latest week: full classic 3× so progression staging stays intact. */
const LATEST_WEEK_OFFSETS: WeekOffsets = {
  push: 0,
  pull: 2,
  legs: 4,
}

/**
 * Rotating shapes for older weeks. Deterministic — no Math.random —
 * so seeds stay reproducible across machines.
 */
const HUMAN_WEEK_SHAPES: WeekOffsets[] = [
  { push: 0, pull: 2, legs: 4 }, // classic M/W/F-ish
  { push: 1, pull: 3, legs: 5 }, // Tue / Thu / Sat
  { push: 0, pull: 3, legs: 6 }, // Mon / Thu / Sun make-up
  { push: 0, pull: null, legs: 4 }, // skipped pull (busy)
  { push: 1, pull: 4, legs: null }, // Tue / Fri, missed legs
  { push: 0, pull: 2, legs: 5 }, // legs slipped to weekend-ish
  { push: 1, pull: 2, legs: 6 }, // clustered mid-week + Sun
  { push: null, pull: 2, legs: 4 }, // missed push
  { push: 0, pull: 3, legs: 5 }, // Mon / Thu / Sat
  { push: 2, pull: 4, legs: 6 }, // Wed / Fri / Sun
]

function offsetsForWeek(week: number): WeekOffsets {
  if (week === 0) return LATEST_WEEK_OFFSETS
  return HUMAN_WEEK_SHAPES[(week - 1) % HUMAN_WEEK_SHAPES.length]!
}

/**
 * Uneven session lengths → varied heatmap intensity cells.
 * Bands intentionally cross heatmapLevelFromTrainingMinutes thresholds
 * (≤35 / ≤52 / ≤82 / >82) so shades aren’t one flat teal.
 */
function durationMinFor(dayKey: DayKey, week: number): number {
  const base: Record<DayKey, number> = {
    push: 48,
    pull: 55,
    legs: 78,
  }
  // Deliberate short / normal / long weeks
  const weekScale = [0.55, 0.85, 1.05, 0.7, 1.2, 0.9, 1.35, 0.65][week % 8]!
  const dayBias = dayKey === "legs" ? 12 : dayKey === "pull" ? 4 : 0
  const minutes = Math.round(base[dayKey] * weekScale + dayBias)
  return Math.min(110, Math.max(18, minutes))
}

function startHourFor(dayKey: DayKey, week: number): number {
  const base = dayKey === "pull" ? 18 : dayKey === "legs" ? 16 : 17
  return base + (week % 3 === 0 ? 1 : 0)
}

export function buildSessionPlan(now = new Date()): PlannedSession[] {
  // Anchor “today” as a Push day so homepage opens on a WEIGHT_UP-ready day.
  const weekOffsets = Array.from({ length: SEED_WEEK_COUNT }, (_, i) => i)

  return weekOffsets.flatMap((week) => {
    const shape = offsetsForWeek(week)
    const dayKeys: DayKey[] = ["push", "pull", "legs"]
    const isLatest = week === 0
    const solidWeek = Math.max(0, SEED_WEEK_COUNT - 1 - week)

    return dayKeys.flatMap((dayKey) => {
      const withinWeek = shape[dayKey]
      if (withinWeek === null) return []

      const daysAgo = week * 7 + withinWeek
      const slots = DAY_SLOTS[dayKey]

      const outcomes: SetOutcome[][] = slots.map((slot, slotIdx) => {
        if (!isLatest) return solidSets(slot, solidWeek)

        if (dayKey === "push" && slotIdx === PUSH_WEIGHT_UP_SLOT) return weightUpSets(slot, 5)
        if (dayKey === "pull" && slotIdx === 0) return holdSets(slot)
        if (dayKey === "legs" && slotIdx === 0) return plateauSets(slot)
        return solidSets(slot, 5)
      })

      const progressionTag: PlannedSession["progressionTag"] = !isLatest
        ? undefined
        : dayKey === "push"
          ? "weight_up"
          : dayKey === "pull"
            ? "hold"
            : "plateau"

      return [
        {
          daysAgo,
          dayKey,
          label: `${SESSION_PREFIX} — ${DAY_LABELS[dayKey].label} W${SEED_WEEK_COUNT - week}`,
          startHourUTC: startHourFor(dayKey, week),
          durationMin: durationMinFor(dayKey, week),
          slots: outcomes,
          progressionTag,
        } satisfies PlannedSession,
      ]
    })
  })
}

export function sessionWindow(
  daysAgo: number,
  startHourUTC: number,
  durationMin: number,
  now = new Date(),
): { started_at: string; finished_at: string } {
  const started = new Date(now)
  started.setUTCHours(startHourUTC, 15, 0, 0)
  started.setUTCDate(started.getUTCDate() - daysAgo)
  const finished = new Date(started.getTime() + durationMin * 60_000)
  return { started_at: started.toISOString(), finished_at: finished.toISOString() }
}
