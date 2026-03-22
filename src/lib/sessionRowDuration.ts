export function formatSessionRowDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "–"
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${m}m`
}
