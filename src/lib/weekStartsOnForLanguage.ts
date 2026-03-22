/** Heatmap calendar uses react-day-picker-style week start: 0 = Sunday, 1 = Monday. */
export function weekStartsOnForLanguage(languageTag: string): 0 | 1 {
  try {
    const firstDay = new Intl.Locale(languageTag).weekInfo?.firstDay
    // ECMA-402: 1 = Monday … 7 = Sunday
    if (firstDay === 7) return 0
    return 1
  } catch {
    return 1
  }
}
