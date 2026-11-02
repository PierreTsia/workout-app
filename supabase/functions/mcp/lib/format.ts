import { muscleLabel, resolveDisplayName, type DisplayLocale } from "./displayLabels.ts"
import { CIRCUIT_BOUNDS, type ParsedExercise } from "./createProgramValidation.ts"
import {
  catalogMapFromBlock,
  dbBlockToParsedCircuit,
  type DaySequenceReadItem,
  type EchoDayExercise,
} from "./daySequenceRead.ts"
import type { CatalogExerciseForProgram } from "./programPersistence.ts"
import type { AmrapScoreValue } from "./amrapScore.ts"
import {
  attachAmrapHistory,
  attachAmrapScores,
  groupSessionHistory,
  type BlockMeta,
  type HistoryBlockRun,
  type HistorySetLog,
  type SessionHistoryItem,
} from "./sessionHistoryGrouping.ts"
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

/**
 * Adaptive Circuit dry_run lines (ADR 0011): compact when all rounds identical,
 * round-by-round when any nested exercise uses a heterogeneous per_round.
 */
const AMRAP_GLOSS_EN = "As many rounds as possible."

export function formatCircuitPreviewLines(
  circuit: Extract<ParsedExercise, { kind: "circuit" }>,
  catalogById: Map<string, CatalogExerciseForProgram>,
  locale: DisplayLocale = "en",
): string[] {
  const labelPart = circuit.label?.trim() ? ` "${circuit.label.trim()}"` : ""
  const isAmrap = circuit.mode === "amrap"
  const capMinutes = circuit.capMinutes ?? CIRCUIT_BOUNDS.cap_minutes.default
  const header = isAmrap
    ? `Circuit${labelPart} — AMRAP ${capMinutes} min`
    : `Circuit${labelPart} — ${circuit.rounds} rounds · rest ${circuit.restSeconds}s · transition ${circuit.transitionSeconds}s`

  const needsExpand = circuit.exercises.some((ex) => {
    if (ex.mode !== "per_round") return false
    const first = ex.perRound[0]
    return ex.perRound.some(
      (c) => c.amount !== first.amount || c.weightKg !== first.weightKg,
    )
  })

  const nameOf = (id: string) => {
    const catalog = catalogById.get(id)
    return resolveDisplayName({ name: catalog?.name, name_en: catalog?.name_en }, locale) || id
  }

  const slug = circuit.benchmarkSlug?.trim()
  const catalogId = circuit.benchmarkCircuitId?.trim()
  const catalogLine = slug
    ? `  benchmark_slug: "${slug}"`
    : catalogId
      ? `  benchmark_id: "${catalogId}"`
      : null
  const heading = isAmrap
    ? [header, AMRAP_GLOSS_EN, ...(catalogLine ? [catalogLine] : [])]
    : [header, ...(catalogLine ? [catalogLine] : [])]

  if (!needsExpand) {
    const exoLines = circuit.exercises.map((ex) => {
      const name = nameOf(ex.exerciseId)
      if (ex.mode === "flat") {
        return `  ${name} — ${ex.amount} @ ${formatWeight(ex.weightKg)}`
      }
      const cell = ex.perRound[0]
      return `  ${name} — ${cell.amount} @ ${formatWeight(cell.weightKg)}`
    })
    return [...heading, ...exoLines]
  }

  const lines = [...heading]
  for (let r = 0; r < circuit.rounds; r++) {
    const parts = circuit.exercises.map((ex) => {
      const name = nameOf(ex.exerciseId)
      if (ex.mode === "flat") {
        return `${name} ${ex.amount}@${formatWeight(ex.weightKg)}`
      }
      const cell = ex.perRound[r] ?? ex.perRound[ex.perRound.length - 1]
      return `${name} ${cell.amount}@${formatWeight(cell.weightKg)}`
    })
    lines.push(`  Round ${r + 1}: ${parts.join(" · ")}`)
  }
  return lines
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

function formatSetMeasure(s: {
  duration_seconds: number | null
  reps_logged: string | null
  weight_logged: number
  was_pr: boolean
}): string {
  const measure = s.duration_seconds ? `${s.duration_seconds}s` : `${s.reps_logged} reps`
  const pr = s.was_pr ? " 🏆 PR" : ""
  return `${measure} × ${formatWeight(s.weight_logged)}${pr}`
}

/** Hero `27+3` plus FR/EN leftover gloss — never the numeral alone. */
export function formatAmrapScoreLines(score: AmrapScoreValue): string[] {
  const hero = `${score.fullRounds}+${score.leftover}`
  const glossFr = `${score.fullRounds} tours · ${score.leftover} ${score.leftoverName}`
  const glossEn = `${score.fullRounds} rounds · ${score.leftover} ${score.leftoverName}`
  return [hero, `${glossFr} / ${glossEn}`]
}

function formatHistoryItemLines(items: SessionHistoryItem[]): string[] {
  return items.flatMap((item) => {
    if (item.kind === "solo") {
      const setDetails = item.sets
        .map(formatSetMeasure)
        .join(", ")
      return [`  - **${item.exercise_name_snapshot}**: ${setDetails}`]
    }
    const labelPart = item.label?.trim() ? ` "${item.label.trim()}"` : ""
    const header = `  - Circuit${labelPart} (${item.exerciseCount} exercises):`
    const scoreLines =
      item.amrapScore != null
        ? formatAmrapScoreLines(item.amrapScore).map((line) => `    ${line}`)
        : []
    const pbLines = item.isPb ? ["    PB"] : []
    const deltaLines =
      item.deltaRounds != null
        ? [
            `    ${item.deltaRounds > 0 ? "+" : ""}${item.deltaRounds} rounds vs last`,
          ]
        : []
    const roundLines = item.rounds.map((r) => {
      const cells = r.cells
        .map((c) => `${c.exercise_name_snapshot} ${formatSetMeasure(c.log)}`)
        .join(" · ")
      return `    Round ${r.round}: ${cells}`
    })
    return [header, ...scoreLines, ...pbLines, ...deltaLines, ...roundLines]
  })
}

export function formatSessionHistory(
  session: SessionForFormat & { id: string },
  logs: HistorySetLog[],
  metaById: Map<string, BlockMeta>,
  runs: HistoryBlockRun[],
  programInfo?: ProgramInfoForSession,
): string {
  const historyItems = attachAmrapScores(
    groupSessionHistory(logs, metaById),
    runs,
    session.id,
  )
  return formatSessionSummary(session, logs, programInfo, historyItems)
}

/**
 * Cross-session history: Cindy days share one catalog PB via
 * {@link attachAmrapHistory}. Used by `get_workout_history`.
 */
export function formatWorkoutHistory(
  sessions: Array<SessionForFormat & { id: string }>,
  logsBySession: Map<string, HistorySetLog[]>,
  metaById: Map<string, BlockMeta>,
  runs: HistoryBlockRun[],
  programBySession?: Map<string, ProgramInfoForSession>,
): string {
  const attached = attachAmrapHistory(
    sessions.map((session) => ({
      sessionId: session.id,
      items: groupSessionHistory(logsBySession.get(session.id) ?? [], metaById),
    })),
    runs,
  )
  const itemsBySession = new Map(attached.map((b) => [b.sessionId, b.items]))
  return sessions
    .map((session) =>
      formatSessionSummary(
        session,
        logsBySession.get(session.id) ?? [],
        programBySession?.get(session.id),
        itemsBySession.get(session.id),
      ),
    )
    .join("\n\n")
}

export function formatSessionSummary(
  session: SessionForFormat,
  sets: SetForFormat[],
  programInfo?: ProgramInfoForSession,
  historyItems?: SessionHistoryItem[],
): string {
  const date = formatDate(session.started_at)
  const duration = formatDuration(session.active_duration_ms)

  const programSuffix = programInfo?.id
    ? ` *(program: ${programInfo.name}, id: ${programInfo.id})*`
    : ""

  const exerciseLines = historyItems
    ? formatHistoryItemLines(historyItems)
    : [...sets.reduce((map, s) => {
        const existing = map.get(s.exercise_name_snapshot) ?? []
        return map.set(s.exercise_name_snapshot, [...existing, s])
      }, new Map<string, SetForFormat[]>()).entries()].map(([name, exSets]) => {
        const setDetails = [...exSets]
          .sort((a, b) => a.set_number - b.set_number)
          .map(formatSetMeasure)
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
  locale: DisplayLocale = "en",
): string {
  const freq = sessionCount > 0 ? (sessionCount / (days / 7)).toFixed(1) : "0"
  const totalSets = volumes.reduce((sum, v) => sum + v.total_sets, 0)

  const volumeLines = volumes
    .filter((v) => v.total_sets > 0)
    .sort((a, b) => b.total_sets - a.total_sets)
    .map(
      (v) =>
        `  - **${muscleLabel(v.muscle_group, locale)}**: ${v.total_sets} sets, ${formatWeight(v.total_volume_kg)} volume`,
    )

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

/** Catalog name in the caller's locale when present, else the frozen snapshot alone. */
function displayExerciseName(
  ex: {
    name_snapshot: string
    name?: string | null
    name_en?: string | null
  },
  locale: DisplayLocale = "en",
): string {
  const name =
    resolveDisplayName(
      { name: ex.name, name_en: ex.name_en, name_snapshot: ex.name_snapshot },
      locale,
    ) || ex.name_snapshot
  return `**${name}**`
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

export interface ProgramDetailsEchoDay {
  id: string
  label: string
  emoji?: string
  exercises: EchoDayExercise[]
}

function formatSoloDetailsLine(ex: ProgramDetailsExercise, locale: DisplayLocale = "en"): string {
  const measure = ex.target_duration_seconds
    ? `${ex.sets} × ${ex.target_duration_seconds}s`
    : `${ex.sets} × ${ex.reps} reps`
  const weightSuffix = Number(ex.weight) > 0 ? ` @ ${ex.weight} kg` : ""
  return `  - ${displayExerciseName(ex, locale)} *(exercise_id: ${ex.exercise_id})*: ${measure}${weightSuffix} (rest ${ex.rest_seconds}s)`
}

function formatSequenceDetailsLines(
  items: DaySequenceReadItem[],
  locale: DisplayLocale = "en",
): string[] {
  return items.flatMap((item) => {
    if (item.kind === "solo") {
      const s = item.solo
      return [
        formatSoloDetailsLine(
          {
            id: s.id ?? s.exercise_id,
            exercise_id: s.exercise_id,
            name_snapshot: s.name_snapshot,
            name: s.name,
            name_en: s.name_en,
            sets: s.sets,
            reps: s.reps,
            weight: s.weight,
            rest_seconds: s.rest_seconds,
            target_duration_seconds: s.target_duration_seconds,
          },
          locale,
        ),
      ]
    }
    const parsed = dbBlockToParsedCircuit(item.block)
    const catalog = catalogMapFromBlock(item.block)
    return formatCircuitPreviewLines(parsed, catalog, locale).map((line) => `  ${line}`)
  })
}

/**
 * Human markdown for a program. When `echoDays` is provided, appends an
 * echo-ready ` ```json ` fence (patch-shaped `days` for `update_program`).
 *
 * Prefer `sequenceByDay` (Unified Day Sequence) when Circuits are present;
 * otherwise `exercisesByDay` keeps the legacy solo-only path.
 */
export function formatProgramDetails(
  program: ProgramDetailsHeader,
  days: ProgramDetailsDay[],
  exercisesByDay: Map<string, ProgramDetailsExercise[]>,
  options?: {
    sequenceByDay?: Map<string, DaySequenceReadItem[]>
    echoDays?: ProgramDetailsEchoDay[]
  },
  locale: DisplayLocale = "en",
): string {
  const archivedSuffix = program.archived_at !== null ? " (archived)" : ""
  const header = `## **${program.name}** *(id: ${program.id})*${archivedSuffix}`

  if (days.length === 0) {
    const empty = [header, "_(empty program — no days defined)_"].join("\n\n")
    return appendEchoFence(empty, options?.echoDays)
  }

  const dayBlocks = days.map((day) => {
    const sequence = options?.sequenceByDay?.get(day.id)
    const exLines = sequence
      ? formatSequenceDetailsLines(sequence, locale)
      : (exercisesByDay.get(day.id) ?? []).map((ex) => formatSoloDetailsLine(ex, locale))
    return [`### ${day.emoji} ${day.label} *(id: ${day.id})*`, ...exLines].join("\n")
  })

  const md = [header, ...dayBlocks].join("\n\n")
  return appendEchoFence(md, options?.echoDays)
}

function appendEchoFence(markdown: string, echoDays?: ProgramDetailsEchoDay[]): string {
  if (!echoDays) return markdown
  const payload = { days: echoDays }
  return `${markdown}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``
}

export function formatWorkoutDay(
  day: WorkoutDayForFormat,
  exercises: WorkoutExForFormat[],
  sequence?: DaySequenceReadItem[],
  locale: DisplayLocale = "en",
): string {
  if (sequence) {
    const exLines = sequence.flatMap((item) => {
      if (item.kind === "solo") {
        const ex = item.solo
        const measure = ex.target_duration_seconds
          ? `${ex.sets} × ${ex.target_duration_seconds}s`
          : `${ex.sets} × ${ex.reps} reps`
        const weight = Number(ex.weight) > 0 ? ` @ ${ex.weight} kg` : ""
        const rest = ex.rest_seconds ? ` (rest ${ex.rest_seconds}s)` : ""
        return [
          `  - ${displayExerciseName(
            {
              name_snapshot: ex.name_snapshot,
              name: ex.name,
              name_en: ex.name_en,
            },
            locale,
          )}: ${measure}${weight}${rest}`,
        ]
      }
      const parsed = dbBlockToParsedCircuit(item.block)
      const catalog = catalogMapFromBlock(item.block)
      return formatCircuitPreviewLines(parsed, catalog, locale).map((line) => `  ${line}`)
    })
    return [`### ${day.emoji} ${day.label}`, ...exLines].join("\n")
  }

  const exLines = exercises.map((ex) => {
    const measure = ex.target_duration_seconds
      ? `${ex.sets} × ${ex.target_duration_seconds}s`
      : `${ex.sets} × ${ex.reps} reps`
    const weight = Number(ex.weight) > 0 ? ` @ ${ex.weight} kg` : ""
    const rest = ex.rest_seconds ? ` (rest ${ex.rest_seconds}s)` : ""
    return `  - ${displayExerciseName(ex, locale)}: ${measure}${weight}${rest}`
  })

  return [`### ${day.emoji} ${day.label}`, ...exLines].join("\n")
}

// ---------------------------------------------------------------------------
// T81 — update_program dry_run rendering helpers
// ---------------------------------------------------------------------------

export const APPLY_DEFAULT_SETS = 3
export const APPLY_DEFAULT_REPS = "10"
export const APPLY_DEFAULT_REST_SECONDS = 90
export const APPLY_DEFAULT_DURATION_SECONDS = 30
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
  locale: DisplayLocale = "en",
): string {
  const finalName = diff.name_change?.to ?? currentProgram.name
  const header = `## **${finalName}** *(id: ${currentProgram.id})*`

  const fromUpdates: RenderableDay[] = diff.days_to_update.map((u) =>
    renderableFromUpdate(u, catalogById, locale),
  )

  const fromInserts: RenderableDay[] = diff.days_to_insert.map((i) =>
    renderableFromInsert(i, catalogById, locale),
  )

  const fromUnchanged: RenderableDay[] = diff.days_unchanged
    .map((u) => currentProgram.days.find((d) => d.id === u.id))
    .filter((d): d is CurrentProgramSnapshotDay => d !== undefined)
    .map((d) => renderableFromCurrent(d, catalogById, locale))

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

function renderableFromUpdate(
  u: DiffDayUpdate,
  catalogById: Map<string, CatalogExerciseForProgram>,
  locale: DisplayLocale = "en",
): RenderableDay {
  return {
    label: u.label,
    emoji: u.emoji,
    sort_order: u.sort_order,
    exerciseLines: u.parsed_exercises.map((p) => `  - ${renderParsedLine(p, catalogById, locale)}`),
  }
}

function renderableFromInsert(
  i: DiffDayInsert,
  catalogById: Map<string, CatalogExerciseForProgram>,
  locale: DisplayLocale = "en",
): RenderableDay {
  return {
    label: i.label,
    emoji: i.emoji ?? DEFAULT_INSERT_EMOJI,
    sort_order: i.sort_order,
    exerciseLines: i.parsed_exercises.map((p) => `  - ${renderParsedLine(p, catalogById, locale)}`),
  }
}

function renderableFromCurrent(
  d: CurrentProgramSnapshotDay,
  catalogById: Map<string, CatalogExerciseForProgram>,
  locale: DisplayLocale = "en",
): RenderableDay {
  const sortedExercises = [...d.workout_exercises].sort((a, b) => a.sort_order - b.sort_order)
  return {
    label: d.label,
    emoji: d.emoji,
    sort_order: d.sort_order,
    exerciseLines: sortedExercises.map(
      (ex) => `  - ${renderCurrentLine(ex, catalogById, locale)}`,
    ),
  }
}

function renderParsedLine(
  parsed: ParsedExercise,
  catalogById: Map<string, CatalogExerciseForProgram>,
  locale: DisplayLocale = "en",
): string {
  if (parsed.kind === "circuit") {
    return formatCircuitPreviewLines(parsed, catalogById, locale).join("\n")
  }

  const catalog = catalogById.get(parsed.exerciseId)
  // Defensive fallback: catalog should always be present (handler fetches the union of
  // patch + current ids), but a missing entry must not crash dry_run rendering.
  const name =
    resolveDisplayName({ name: catalog?.name, name_en: catalog?.name_en }, locale) ||
    "(unknown exercise)"
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
  locale: DisplayLocale = "en",
): string {
  const catalog = catalogById.get(ex.exercise_id)
  const name =
    resolveDisplayName({ name: catalog?.name, name_en: catalog?.name_en }, locale) ||
    ex.name_snapshot
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
