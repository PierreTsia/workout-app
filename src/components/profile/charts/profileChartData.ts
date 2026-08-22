import { addDays, format } from "date-fns"
import { enUS, fr } from "date-fns/locale"
import {
  isoWeekMonday,
  parseGrainKey,
} from "@/lib/profile/grain"
import { MUSCLE_TAXONOMY, type MuscleTaxonomy } from "@/lib/trainingBalance"

type Translate = (
  key: string,
  options?: Record<string, string | number>,
) => string

const WEEKDAY_I18N: Record<string, string> = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
}

const MONTH_I18N = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const

const DATE_LOCALE = { fr, en: enUS } as const

function dateLocale(language: string) {
  return language.startsWith("fr") ? DATE_LOCALE.fr : DATE_LOCALE.en
}

/** Shared Y gutters so Mix / Rhythm / Tonnage / Records plot the same width. */
export const PROFILE_Y_LEFT = 28
export const PROFILE_Y_RIGHT = 36

/** Force every tick on short grains; drop overlaps on 100d / year. */
export function profileTickInterval(
  categoryCount: number,
): 0 | "preserveStartEnd" {
  return categoryCount > 8 ? "preserveStartEnd" : 0
}

/** W / W-14 / W3 / 2026-W34 / 2026-08-17 → short axis marks (S34, Lun, août 26). */
export function localizeProfileTick(label: string, t: Translate): string {
  const parsed = parseGrainKey(label)
  if (parsed.kind === "isoWeek") return t("rhythm.week", { n: parsed.week })
  if (parsed.kind === "day") {
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(`${parsed.day}T12:00:00Z`).getUTCDay()
    ]
    return weekday == null ? label : localizeProfileTick(weekday, t)
  }
  if (parsed.kind === "month") {
    const monthKey = MONTH_I18N[parsed.month - 1]
    return monthKey == null ? label : t(`rhythm.month.${monthKey}`)
  }
  if (parsed.kind === "year") return String(parsed.year)
  if (label === "W") return t("rhythm.weekCurrent")
  const offset = /^W-(\d+)$/.exec(label)
  if (offset) return t("rhythm.weekAgo", { n: offset[1] })
  const sequential = /^W(\d+)$/.exec(label)
  if (sequential) return t("rhythm.week", { n: sequential[1] })
  const weekdayKey = WEEKDAY_I18N[label]
  if (weekdayKey) return t(`rhythm.weekday.${weekdayKey}`)
  return label
}

function weekSpan(year: number, week: number, language: string): string {
  const monday = isoWeekMonday(year, week)
  const sunday = addDays(monday, 6)
  const locale = dateLocale(language)
  if (monday.getMonth() === sunday.getMonth()) {
    return `${format(monday, "d", { locale })}–${format(sunday, "d MMM", { locale })}`
  }
  return `${format(monday, "d MMM", { locale })}–${format(sunday, "d MMM", { locale })}`
}

/** Axis mark plus the calendar span, for tooltips. */
export function formatProfileTooltipLabel(
  key: string,
  t: Translate,
  language: string,
): string {
  const tick = localizeProfileTick(key, t)
  const parsed = parseGrainKey(key)
  if (parsed.kind === "isoWeek") {
    return t("rhythm.tooltip.weekCaption", {
      week: tick,
      span: weekSpan(parsed.year, parsed.week, language),
    })
  }
  if (parsed.kind === "day") {
    const date = new Date(`${parsed.day}T12:00:00Z`)
    return t("rhythm.tooltip.dayCaption", {
      weekday: tick,
      date: format(date, "d MMM", { locale: dateLocale(language) }),
    })
  }
  if (parsed.kind === "month") {
    const date = new Date(parsed.year, parsed.month - 1, 1)
    return format(date, "MMMM yyyy", { locale: dateLocale(language) })
  }
  return tick
}

export type MixSeries = {
  programme: readonly number[]
  quickWorkout: readonly number[]
  circuits: readonly number[]
}

export type MixCountRow = {
  category: string
  programme: number
  quickWorkout: number
  circuits: number
}

/** One session, one stack. Height is the session count, not a 100% share. */
export function toMixCountRows(
  categories: readonly string[],
  series: MixSeries,
): MixCountRow[] {
  return categories.map((category, i) => ({
    category,
    programme: series.programme[i] ?? 0,
    quickWorkout: series.quickWorkout[i] ?? 0,
    circuits: series.circuits[i] ?? 0,
  }))
}

export type RecordsComboSeries = {
  prs: readonly number[]
  rir0: readonly (number | null)[]
}

export type RecordsComboRow = {
  category: string
  prs: number
  rir0: number | null
}

export function toRecordsComboRows(
  categories: readonly string[],
  series: RecordsComboSeries,
): RecordsComboRow[] {
  return categories.map((category, i) => ({
    category,
    prs: series.prs[i] ?? 0,
    rir0: series.rir0[i] ?? null,
  }))
}

export type MuscleRadarValues = Record<MuscleTaxonomy, number>

export type MuscleRadarSeries = {
  current: MuscleRadarValues
  prior?: MuscleRadarValues
}

export type MuscleRadarRow = {
  muscle: MuscleTaxonomy
  current: number
  prior?: number
  currentSets: number
  priorSets?: number
}

export function scaleRadarCredits(values: MuscleRadarValues): MuscleRadarValues {
  return {
    Pectoraux: values.Pectoraux * PIERRE_SET_CREDIT_SCALE,
    Dos: values.Dos * PIERRE_SET_CREDIT_SCALE,
    Épaules: values.Épaules * PIERRE_SET_CREDIT_SCALE,
    Biceps: values.Biceps * PIERRE_SET_CREDIT_SCALE,
    Triceps: values.Triceps * PIERRE_SET_CREDIT_SCALE,
    Quadriceps: values.Quadriceps * PIERRE_SET_CREDIT_SCALE,
    Ischios: values.Ischios * PIERRE_SET_CREDIT_SCALE,
    Fessiers: values.Fessiers * PIERRE_SET_CREDIT_SCALE,
    Adducteurs: values.Adducteurs * PIERRE_SET_CREDIT_SCALE,
    Mollets: values.Mollets * PIERRE_SET_CREDIT_SCALE,
    Abdos: values.Abdos * PIERRE_SET_CREDIT_SCALE,
    Trapèzes: values.Trapèzes * PIERRE_SET_CREDIT_SCALE,
    Lombaires: values.Lombaires * PIERRE_SET_CREDIT_SCALE,
  }
}

export function toRadarRows(series: MuscleRadarSeries): MuscleRadarRow[] {
  const prior = series.prior
  const peak = Math.max(
    1,
    ...MUSCLE_TAXONOMY.map((muscle) => series.current[muscle]),
    ...(prior == null ? [] : MUSCLE_TAXONOMY.map((muscle) => prior[muscle])),
  )
  return MUSCLE_TAXONOMY.map((muscle) => {
    const currentSets = series.current[muscle]
    if (prior === undefined) {
      return { muscle, current: currentSets / peak, currentSets }
    }
    const priorSets = prior[muscle]
    return {
      muscle,
      current: currentSets / peak,
      prior: priorSets / peak,
      currentSets,
      priorSets,
    }
  })
}

/** T0 fixture is 0–1. Multiply to credited sets before the radar/ranks consume a VM. */
export const PIERRE_SET_CREDIT_SCALE = 20

export type MuscleSetRank = {
  muscle: MuscleTaxonomy
  sets: number
  fill: number
}

export function toMuscleSetRanks(values: MuscleRadarValues): MuscleSetRank[] {
  const peakRaw = MUSCLE_TAXONOMY.reduce(
    (max, muscle) => Math.max(max, values[muscle]),
    0,
  )
  const unit = peakRaw > 0 && peakRaw <= 1 ? PIERRE_SET_CREDIT_SCALE : 1
  const rows = MUSCLE_TAXONOMY.map((muscle) => ({
    muscle,
    sets: Math.round(values[muscle] * unit),
  }))
  const peak = rows.reduce((max, row) => Math.max(max, row.sets), 0)
  const ranked = rows.map((row) => ({
    ...row,
    fill: peak === 0 ? 0 : row.sets / peak,
  }))
  return [...ranked].sort(
    (a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle),
  )
}
