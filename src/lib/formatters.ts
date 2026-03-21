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

export function formatRelativeDate(iso: string, locale = "en"): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  const fmt = getRelativeFormatter(locale)
  const raw = days < 7 ? fmt.format(-days, "day") : fmt.format(-Math.floor(days / 7), "week")
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`
}

export function formatDurationMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`
}
