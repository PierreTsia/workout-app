const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000

export function formatDate(iso: string): string {
  const d = new Date(iso)
  const date = d.toISOString().slice(0, 10)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86_400_000)

  if (days === 0) return `${date} (today)`
  if (days === 1) return `${date} (yesterday)`
  if (days < 7) return `${date} (${days} days ago)`
  if (days < 30) return `${date} (${Math.floor(days / 7)} weeks ago)`
  return date
}

export function formatWeight(kg: number): string {
  return kg % 1 === 0 ? `${kg} kg` : `${kg.toFixed(1)} kg`
}

export function formatDuration(ms: number | null): string {
  if (!ms) return "unknown"
  if (ms < MS_PER_MINUTE) return `${Math.round(ms / 1000)}s`
  if (ms < MS_PER_HOUR) return `${Math.round(ms / MS_PER_MINUTE)} min`
  const h = Math.floor(ms / MS_PER_HOUR)
  const m = Math.round((ms % MS_PER_HOUR) / MS_PER_MINUTE)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

interface SetForFormat {
  exercise_name_snapshot: string
  set_number: number
  reps_logged: string | null
  duration_seconds: number | null
  weight_logged: number
  was_pr: boolean
}

interface SessionForFormat {
  workout_label_snapshot: string
  started_at: string
  finished_at: string | null
  active_duration_ms: number | null
  total_sets_done: number
}

export function formatSessionSummary(session: SessionForFormat, sets: SetForFormat[]): string {
  const date = formatDate(session.started_at)
  const duration = formatDuration(session.active_duration_ms)

  const exerciseMap = new Map<string, SetForFormat[]>()
  for (const s of sets) {
    const existing = exerciseMap.get(s.exercise_name_snapshot) ?? []
    existing.push(s)
    exerciseMap.set(s.exercise_name_snapshot, existing)
  }

  const exerciseLines = [...exerciseMap.entries()].map(([name, exSets]) => {
    const setDetails = exSets
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => {
        const measure = s.duration_seconds ? `${s.duration_seconds}s` : `${s.reps_logged} reps`
        const pr = s.was_pr ? " 🏆 PR" : ""
        return `${measure} × ${formatWeight(s.weight_logged)}${pr}`
      })
      .join(", ")
    return `  - **${name}**: ${setDetails}`
  })

  return [
    `### ${session.workout_label_snapshot} — ${date}`,
    `Duration: ${duration} | ${session.total_sets_done} sets`,
    ...exerciseLines,
  ].join("\n")
}

interface VolumeRow {
  muscle_group: string
  total_sets: number
  total_volume_kg: number
  exercise_count?: number
}

interface PrRow {
  exercise_name_snapshot: string
  weight_logged: number
  reps_logged: string | null
  duration_seconds: number | null
  logged_at: string
}

export function formatStatsSummary(
  days: number,
  sessionCount: number,
  volumes: VolumeRow[],
  prs: PrRow[],
): string {
  const freq = sessionCount > 0 ? (sessionCount / (days / 7)).toFixed(1) : "0"
  const totalSets = volumes.reduce((sum, v) => sum + v.total_sets, 0)

  const volumeLines = volumes
    .filter((v) => v.total_sets > 0)
    .sort((a, b) => b.total_sets - a.total_sets)
    .map((v) => `  - **${v.muscle_group}**: ${v.total_sets} sets, ${formatWeight(v.total_volume_kg)} volume`)

  const prLines = prs.map((p) => {
    const measure = p.duration_seconds ? `${p.duration_seconds}s` : `${p.reps_logged} reps`
    return `  - **${p.exercise_name_snapshot}**: ${formatWeight(p.weight_logged)} × ${measure} (${formatDate(p.logged_at)})`
  })

  const sections = [
    `## Training Stats — last ${days} days`,
    `**Sessions:** ${sessionCount} (${freq}/week)`,
    `**Total sets:** ${totalSets}`,
  ]

  if (volumeLines.length > 0) {
    sections.push("", "**Volume by muscle group:**", ...volumeLines)
  }

  if (prLines.length > 0) {
    sections.push("", `**Personal records (${prs.length}):**`, ...prLines)
  }

  return sections.join("\n")
}

interface WorkoutExForFormat {
  name_snapshot: string
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  target_duration_seconds?: number | null
}

interface WorkoutDayForFormat {
  label: string
  emoji: string
}

export function formatWorkoutDay(day: WorkoutDayForFormat, exercises: WorkoutExForFormat[]): string {
  const exLines = exercises.map((ex) => {
    const measure = ex.target_duration_seconds
      ? `${ex.sets} × ${ex.target_duration_seconds}s`
      : `${ex.sets} × ${ex.reps} reps`
    const weight = Number(ex.weight) > 0 ? ` @ ${ex.weight} kg` : ""
    const rest = ex.rest_seconds ? ` (rest ${ex.rest_seconds}s)` : ""
    return `  - **${ex.name_snapshot}**: ${measure}${weight}${rest}`
  })

  return [`### ${day.emoji} ${day.label}`, ...exLines].join("\n")
}
