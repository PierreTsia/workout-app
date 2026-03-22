/** YYYY-MM-DD for an instant in a specific IANA time zone (en-CA orders y-m-d). */
export function formatSessionDayKeyInTimeZone(isoInstant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoInstant))
}
