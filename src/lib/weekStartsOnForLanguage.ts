/**
 * ECMA-402 firstDay: 1 = Monday … 7 = Sunday (not in our TS lib yet).
 *
 * The accessor moved from a `weekInfo` getter to a `getWeekInfo()` method
 * (Node 26 / recent V8 dropped the getter), so we try the method first and fall
 * back to the legacy getter for older runtimes.
 */
function intlLocaleWeekFirstDay(languageTag: string): number | undefined {
  try {
    const locale = new Intl.Locale(languageTag)
    const getWeekInfo = Reflect.get(locale, "getWeekInfo")
    const info =
      typeof getWeekInfo === "function"
        ? getWeekInfo.call(locale)
        : Reflect.get(locale, "weekInfo")
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
