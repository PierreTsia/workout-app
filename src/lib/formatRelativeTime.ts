const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1_000],
]

export function formatRelativeTime(dateString: string, locale: string): string {
  const elapsed = new Date(dateString).getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  for (const [unit, ms] of UNITS) {
    if (Math.abs(elapsed) >= ms || unit === "second") {
      return rtf.format(Math.round(elapsed / ms), unit)
    }
  }
  return rtf.format(0, "second")
}
