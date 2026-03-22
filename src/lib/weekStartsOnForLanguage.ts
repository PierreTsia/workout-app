/** ECMA-402 weekInfo.firstDay: 1 = Monday … 7 = Sunday (supported in modern runtimes; not in our TS lib yet). */
function intlLocaleWeekFirstDay(languageTag: string): number | undefined {
  try {
    const locale = new Intl.Locale(languageTag)
    const info = Reflect.get(locale, "weekInfo")
    if (!info || typeof info !== "object") return undefined
    const fd = (info as { firstDay?: unknown }).firstDay
    return typeof fd === "number" ? fd : undefined
  } catch {
    return undefined
  }
}

/** Heatmap calendar uses react-day-picker-style week start: 0 = Sunday, 1 = Monday. */
export function weekStartsOnForLanguage(languageTag: string): 0 | 1 {
  const firstDay = intlLocaleWeekFirstDay(languageTag)
  if (firstDay === 7) return 0
  return 1
}
