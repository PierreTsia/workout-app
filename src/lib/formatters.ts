const dateFormatCache = new Map<string, Intl.DateTimeFormat>()
const numberFormatCache = new Map<string, Intl.NumberFormat>()

export function formatDate(
  date: Date | string,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date
  const key = `${locale}-${JSON.stringify(options)}`
  let fmt = dateFormatCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options)
    dateFormatCache.set(key, fmt)
  }
  return fmt.format(d)
}

export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  const key = `${locale}-${JSON.stringify(options)}`
  let fmt = numberFormatCache.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options)
    numberFormatCache.set(key, fmt)
  }
  return fmt.format(value)
}

const relativeCache = new Map<string, Intl.RelativeTimeFormat>()

function getRelativeFormatter(locale: string): Intl.RelativeTimeFormat {
  let fmt = relativeCache.get(locale)
  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    relativeCache.set(locale, fmt)
  }
  return fmt
}

/**
 * Calendar-day distance from `then` to `now` in the user's local timezone
 * (0 = same local calendar day). Not the same as floor(elapsed ms / 24h), which
 * mislabels "yesterday evening" as "today" when fewer than 24h have passed.
 */
function diffLocalCalendarDays(now: Date, then: Date): number {
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((startNow.getTime() - startThen.getTime()) / 86_400_000)
}

export function formatRelativeDate(iso: string, locale = "en"): string {
  const then = new Date(iso)
  const now = new Date()
  const days = Math.max(0, diffLocalCalendarDays(now, then))
  const fmt = getRelativeFormatter(locale)
  const raw =
    days < 7 ? fmt.format(-days, "day") : fmt.format(-Math.floor(days / 7), "week")
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** Same rules as `formatDuration` but from a millisecond length (workout card, summaries). */
export function formatDurationFromMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`
}

export function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  return formatDurationFromMs(ms)
}

/** Prefer wall-clock when `active_duration_ms` is null (legacy sessions). */
export function formatSessionDurationForDisplay(
  startedAt: string,
  finishedAt: string,
  activeDurationMs: number | null | undefined,
): string {
  const ms =
    activeDurationMs != null && activeDurationMs >= 0
      ? activeDurationMs
      : new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  return formatDurationFromMs(ms)
}

export function formatDurationMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`
}

/** Countdown / hold display (e.g. 1:05). */
export function formatSecondsMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, "0")}`
}
