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
