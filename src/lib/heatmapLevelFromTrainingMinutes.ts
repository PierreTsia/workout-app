/**
 * Intensity when cell `value` = training minutes that day (RPC `minutes`).
 * Returns 0…6 — pair with seven `levelClassNames` on HeatmapCalendar (empty + 6 shades).
 * Long-session bands are split so ~47m vs ~80m land on different levels (4 vs 5).
 */
export function heatmapLevelFromTrainingMinutes(minutes: number): number {
  if (minutes <= 0) return 0
  if (minutes <= 10) return 1
  if (minutes <= 22) return 2
  if (minutes <= 35) return 3
  if (minutes <= 52) return 4
  if (minutes <= 82) return 5
  return 6
}
