/**
 * Formats a past (or future) instant with Intl.RelativeTimeFormat.
 * `locale` should match i18n (e.g. "en", "fr").
 */
export function formatRelativePast(iso: string, locale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const loc = locale.toLowerCase().startsWith("fr") ? "fr-FR" : "en-US"
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" })
  const now = Date.now()
  const diffSec = Math.round((date.getTime() - now) / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)
  const diffWeek = Math.round(diffDay / 7)
  const diffMonth = Math.round(diffDay / 30)
  const diffYear = Math.round(diffDay / 365)

  if (Math.abs(diffSec) < 45) return rtf.format(diffSec, "second")
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute")
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour")
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, "day")
  if (Math.abs(diffWeek) < 5) return rtf.format(diffWeek, "week")
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month")
  return rtf.format(diffYear, "year")
}
