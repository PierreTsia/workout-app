/** Intensity buckets when heatmap cell `value` = training minutes that day (RPC `minutes`). */
export function heatmapLevelFromTrainingMinutes(minutes: number): number {
  if (minutes <= 0) return 0
  if (minutes <= 15) return 1
  if (minutes <= 30) return 2
  if (minutes <= 45) return 3
  return 4
}
