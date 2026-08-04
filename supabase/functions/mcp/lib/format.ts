import { formatBilingualExerciseName } from "./bilingualName.ts"
import type { ParsedExercise } from "./createProgramValidation.ts"
import type { CatalogExerciseForProgram } from "./programPersistence.ts"
import type {
  CurrentProgramSnapshot,
  CurrentProgramSnapshotDay,
  CurrentProgramSnapshotExercise,
  DiffDayInsert,
  DiffDayUpdate,
  ProgramDiff,
} from "./updateProgramTypes.ts"

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000

export type WeightConvention = "per_hand" | "total" | "bodyweight"

const WEIGHT_CONVENTION_BY_EQUIPMENT: Record<string, WeightConvention> = {
  dumbbell: "per_hand",
  kettlebell: "per_hand",
  barbell: "total",
  machine: "total",
  cable: "total",
  bodyweight: "bodyweight",
  band: "total",
  other: "total",
}

export function formatWeightConvention(equipment: string): WeightConvention {
  const known = WEIGHT_CONVENTION_BY_EQUIPMENT[equipment]
  if (known) return known
  console.warn(
    `[formatWeightConvention] Unknown equipment "${equipment}", falling back to "total". Update WEIGHT_CONVENTION_BY_EQUIPMENT if this is a new catalog value.`,
  )
  return "total"
}

interface FormatPrescriptionInput {
  exerciseName: string
  sets: number
  reps: string
  weightKg: number
  restSeconds: number
  weightConvention: WeightConvention
  /** When set, renders the line as a duration prescription (T75). For T74 reps mode, leave undefined. */
  targetDurationSeconds?: number
}

export function formatPrescriptionLine(input: FormatPrescriptionInput): string {
  const { exerciseName, sets, reps, weightKg, restSeconds, weightConvention, targetDurationSeconds } = input
  const restSuffix = `${restSeconds}s rest`
  // T75: duration mode wins — render `{sets} × {N}s` and skip reps/weight
  // entirely (defensive: even if upstream forgets to zero them out, they don't
  // leak into the agent-visible echo).
  if (targetDurationSeconds !== undefined && targetDurationSeconds !== null) {
    return `${exerciseName} — ${sets} × ${targetDurationSeconds}s — ${restSuffix}`
  }
  if (weightConvention === "bodyweight") {
    return `${exerciseName} — ${sets} × ${reps} (bodyweight) — ${restSuffix}`
  }
  const conventionSuffix = weightConvention === "per_hand" ? "per hand" : "total"
  return `${exerciseName} — ${sets} × ${reps} × ${formatWeight(weightKg)} ${conventionSuffix} — ${restSuffix}`
}

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

interface ProgramInfoForSession {
  id: string
  name: string
}

export function formatSessionSummary(
  session: SessionForFormat,
  sets: SetForFormat[],
  programInfo?: ProgramInfoForSession,
): string {
  const date = formatDate(session.started_at)
  const duration = formatDuration(session.active_duration_ms)

  const programSuffix = programInfo?.id
    ? ` *(program: ${programInfo.name}, id: ${programInfo.id})*`
    : ""

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
    `### ${session.workout_label_snapshot} — ${date}${programSuffix}`,
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
  /** Catalog French name when the join succeeded; otherwise omit. */
  name?: string | null
  name_en?: string | null
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  target_duration_seconds?: number | null
}

/** Catalog name (FR + EN) when present, else the frozen snapshot alone. */
function displayExerciseName(ex: {
  name_snapshot: string
  name?: string | null
  name_en?: string | null
}): string {
  const french = ex.name?.trim() || ex.name_snapshot
  return formatBilingualExerciseName(french, ex.name_en)
}

interface WorkoutDayForFormat {
  label: string
  emoji: string
}

interface ProgramListEntry {
  id: string
  name: string
  is_active: boolean
  day_count: number
  created_at: string
  has_active_cycle: boolean
  archived_at: string | null
}

export function formatProgramListEntry(entry: ProgramListEntry): string {
  const date = new Date(entry.created_at).toISOString().slice(0, 10)
  const suffix = entry.archived_at !== null
    ? "(archived)"
    : !entry.is_active
      ? "(draft)"
      : entry.has_active_cycle
        ? "(active, cycle in progress)"
        : "(active)"
  return `**${entry.name}** *(id: ${entry.id})* — ${entry.day_count} days, created ${date} ${suffix}`
}

interface ProgramDetailsHeader {
  id: string
  name: string
  archived_at: string | null
}

interface ProgramDetailsDay {
  id: string
  label: string
  emoji: string
  sort_order: number
}

interface ProgramDetailsExercise {
  id: string
  exercise_id: string
  name_snapshot: string
  name?: string | null
  name_en?: string | null
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  target_duration_seconds: number | null
}

export function formatProgramDetails(
  program: ProgramDetailsHeader,
  days: ProgramDetailsDay[],
  exercisesByDay: Map<string, ProgramDetailsExercise[]>,
): string {
  const archivedSuffix = program.archived_at !== null ? " (archived)" : ""
  const header = `## **${program.name}** *(id: ${program.id})*${archivedSuffix}`

  if (days.length === 0) {
    return [header, "_(empty program — no days defined)_"].join("\n\n")
  }

  const dayBlocks = days.map((day) => {
    const exercises = exercisesByDay.get(day.id) ?? []
    const exLines = exercises.map((ex) => {
      const measure = ex.target_duration_seconds
        ? `${ex.sets} × ${ex.target_duration_seconds}s`
        : `${ex.sets} × ${ex.reps} reps`
      const weightSuffix = Number(ex.weight) > 0 ? ` @ ${ex.weight} kg` : ""
      return `  - ${displayExerciseName(ex)} *(exercise_id: ${ex.exercise_id})*: ${measure}${weightSuffix} (rest ${ex.rest_seconds}s)`
    })
    return [`### ${day.emoji} ${day.label} *(id: ${day.id})*`, ...exLines].join("\n")
  })

  return [header, ...dayBlocks].join("\n\n")
}

export function formatWorkoutDay(day: WorkoutDayForFormat, exercises: WorkoutExForFormat[]): string {
  const exLines = exercises.map((ex) => {
    const measure = ex.target_duration_seconds
      ? `${ex.sets} × ${ex.target_duration_seconds}s`
      : `${ex.sets} × ${ex.reps} reps`
    const weight = Number(ex.weight) > 0 ? ` @ ${ex.weight} kg` : ""
    const rest = ex.rest_seconds ? ` (rest ${ex.rest_seconds}s)` : ""
    return `  - ${displayExerciseName(ex)}: ${measure}${weight}${rest}`
  })

  return [`### ${day.emoji} ${day.label}`, ...exLines].join("\n")
}

// ---------------------------------------------------------------------------
// T81 — update_program dry_run rendering helpers
// ---------------------------------------------------------------------------

const APPLY_DEFAULT_SETS = 3
const APPLY_DEFAULT_REPS = "10"
const APPLY_DEFAULT_REST_SECONDS = 90
const APPLY_DEFAULT_DURATION_SECONDS = 30
const DEFAULT_INSERT_EMOJI = "🏋️"

interface RenderableDay {
  label: string
  emoji: string
  sort_order: number
  exerciseLines: string[]
}

/**
 * Renders the program AS IT WILL BE after the diff is applied (dry_run preview).
 *
 * - Header uses the renamed name when `diff.name_change` is set, otherwise the current name.
 * - Days come from `days_to_update` + `days_to_insert` + `days_unchanged` (deletes excluded),
 *   sorted by their final `sort_order`.
 * - Exercises are rendered via `formatPrescriptionLine` so the dry_run output mirrors the
 *   convention-aware echo agents already see from `create_program`.
 * - Bare-string exercises resolve to legacy defaults (3×10 @ 0kg, 90s rest), with the duration
 *   branch kicking in for `measurement_type === "duration"` catalog entries.
 *
 * Caller contract: `catalogById` must contain every `exercise_id` referenced across
 * `days_to_update`, `days_to_insert`, and the unchanged days' persisted exercises.
 */
export function formatProgramAfterUpdate(
  diff: ProgramDiff,
  currentProgram: CurrentProgramSnapshot,
  catalogById: Map<string, CatalogExerciseForProgram>,
): string {
  const finalName = diff.name_change?.to ?? currentProgram.name
  const header = `## **${finalName}** *(id: ${currentProgram.id})*`

  const fromUpdates: RenderableDay[] = diff.days_to_update.map((u) =>
    renderableFromUpdate(u, catalogById),
  )

  const fromInserts: RenderableDay[] = diff.days_to_insert.map((i) =>
    renderableFromInsert(i, catalogById),
  )

  const fromUnchanged: RenderableDay[] = diff.days_unchanged
    .map((u) => currentProgram.days.find((d) => d.id === u.id))
    .filter((d): d is CurrentProgramSnapshotDay => d !== undefined)
    .map((d) => renderableFromCurrent(d, catalogById))

  const finalDays = [...fromUpdates, ...fromInserts, ...fromUnchanged].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  if (finalDays.length === 0) {
    return [header, "_(empty program — no days defined)_"].join("\n\n")
  }

  const dayBlocks = finalDays.map((d) =>
    [`### ${d.emoji} ${d.label}`, ...d.exerciseLines].join("\n"),
  )
  return [header, ...dayBlocks].join("\n\n")
}

/**
 * Returns the active-cycle warning string surfaced in both dry_run and apply responses
 * when the program is currently being followed in an unfinished cycle.
 *
 * The message is intentionally French — it lands as-is in the agent's reply and the
 * product copy is localized at this layer (cf. Tech Plan).
 */
export function formatActiveCycleWarning(cycle: { started_at: string }): string {
  // started_at is an ISO-8601 timestamp; the literal YYYY-MM-DD prefix is enough
  // and avoids any timezone surprises.
  const date = cycle.started_at.slice(0, 10)
  return `Cycle actif depuis ${date} — cette modification affecte vos workouts restants dans ce cycle.`
}

function renderableFromUpdate(
  u: DiffDayUpdate,
  catalogById: Map<string, CatalogExerciseForProgram>,
): RenderableDay {
  return {
    label: u.label,
    emoji: u.emoji,
    sort_order: u.sort_order,
    exerciseLines: u.parsed_exercises.map((p) => `  - ${renderParsedLine(p, catalogById)}`),
  }
}

function renderableFromInsert(
  i: DiffDayInsert,
  catalogById: Map<string, CatalogExerciseForProgram>,
): RenderableDay {
  return {
    label: i.label,
    emoji: i.emoji ?? DEFAULT_INSERT_EMOJI,
    sort_order: i.sort_order,
    exerciseLines: i.parsed_exercises.map((p) => `  - ${renderParsedLine(p, catalogById)}`),
  }
}

function renderableFromCurrent(
  d: CurrentProgramSnapshotDay,
  catalogById: Map<string, CatalogExerciseForProgram>,
): RenderableDay {
  const sortedExercises = [...d.workout_exercises].sort((a, b) => a.sort_order - b.sort_order)
  return {
    label: d.label,
    emoji: d.emoji,
    sort_order: d.sort_order,
    exerciseLines: sortedExercises.map((ex) => `  - ${renderCurrentLine(ex, catalogById)}`),
  }
}

function renderParsedLine(
  parsed: ParsedExercise,
  catalogById: Map<string, CatalogExerciseForProgram>,
): string {
  const catalog = catalogById.get(parsed.exerciseId)
  // Defensive fallback: catalog should always be present (handler fetches the union of
  // patch + current ids), but a missing entry must not crash dry_run rendering.
  const name = catalog?.name ?? "(unknown exercise)"
  const convention = catalog ? formatWeightConvention(catalog.equipment) : "total"

  if (parsed.kind === "bare") {
    const isDuration = catalog?.measurement_type === "duration"
    const targetDuration = isDuration
      ? (catalog?.default_duration_seconds ?? APPLY_DEFAULT_DURATION_SECONDS)
      : undefined
    return formatPrescriptionLine({
      exerciseName: name,
      sets: APPLY_DEFAULT_SETS,
      reps: APPLY_DEFAULT_REPS,
      weightKg: 0,
      restSeconds: APPLY_DEFAULT_REST_SECONDS,
      weightConvention: convention,
      ...(targetDuration !== undefined ? { targetDurationSeconds: targetDuration } : {}),
    })
  }

  return formatPrescriptionLine({
    exerciseName: name,
    sets: parsed.sets,
    reps: parsed.reps,
    weightKg: parsed.weightKg,
    restSeconds: parsed.restSeconds,
    weightConvention: convention,
    ...(parsed.targetDurationSeconds !== null && parsed.targetDurationSeconds !== undefined
      ? { targetDurationSeconds: parsed.targetDurationSeconds }
      : {}),
  })
}

function renderCurrentLine(
  ex: CurrentProgramSnapshotExercise,
  catalogById: Map<string, CatalogExerciseForProgram>,
): string {
  const catalog = catalogById.get(ex.exercise_id)
  const name = catalog?.name ?? ex.name_snapshot
  const convention = catalog ? formatWeightConvention(catalog.equipment) : "total"

  return formatPrescriptionLine({
    exerciseName: name,
    sets: ex.sets,
    reps: ex.reps,
    weightKg: Number(ex.weight),
    restSeconds: ex.rest_seconds,
    weightConvention: convention,
    ...(ex.target_duration_seconds !== null
      ? { targetDurationSeconds: ex.target_duration_seconds }
      : {}),
  })
}
