/** One row from get_training_activity_by_day (sparse). `day` is YYYY-MM-DD from PostgREST. */
export interface TrainingDayBucketRow {
  day: string
  session_count: number
  minutes: number
}

/** Dense series for heatmap / charts: every calendar day in range. */
export interface TrainingDayDense {
  date: string
  session_count: number
  minutes: number
}
