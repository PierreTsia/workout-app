const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["week", 7 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1_000],
]

/** BCP 47-ish locale for consistent RelativeTimeFormat output (workout + admin). */
function localeForRelativeFormat(locale: string): string {
  const l = locale.toLowerCase()
  if (l.startsWith("fr")) return "fr-FR"
  return locale
}

/**
 * Formats an instant relative to now (past or future) using Intl.RelativeTimeFormat.
 * Supports second through year buckets. Invalid ISO strings return "".
 */
export function formatRelativeTime(dateString: string, locale: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ""

  const elapsed = date.getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat(localeForRelativeFormat(locale), {
    numeric: "auto",
  })

  for (const [unit, ms] of UNITS) {
    if (Math.abs(elapsed) >= ms || unit === "second") {
      return rtf.format(Math.round(elapsed / ms), unit)
    }
  }
  return rtf.format(0, "second")
}
