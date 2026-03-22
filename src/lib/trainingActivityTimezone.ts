/**
 * IANA timezone for bucketing training days (must match RPC p_tz).
 * Falls back to UTC if the resolved zone is unusable.
 */
export function getResolvedIANATimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && typeof tz === "string" && tz.length > 0) {
      // Throws RangeError for invalid IANA names
      new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date())
      return tz
    }
  } catch {
    /* fall through */
  }
  if (import.meta.env.DEV) {
    console.warn("[trainingActivity] Falling back to UTC for timezone")
  }
  return "UTC"
}
