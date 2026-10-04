import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"

import { isRunComplete, runCompletionSeconds, type CompletionCell } from "./blockCompletion.ts"
import {
  attachAmrapScores,
  buildBlockMetaMap,
  groupSessionHistory,
  type BlockExerciseMetaRow,
  type BlockHistoryCell,
  type BlockHistoryGroup,
  type HistoryBlockRun,
  type HistorySetLog,
  type SessionHistoryItem,
} from "./sessionHistoryGrouping.ts"
import { sessionTonnageKg } from "./tonnage.ts"

export type SessionCardLocale = "en" | "fr"

export type SessionCardSoloSet = { measure: string; weightKg: number; isPr: boolean }
export type SessionCardSoloItem = { kind: "solo"; name: string; sets: SessionCardSoloSet[] }
export type SessionCardCircuitItem = {
  kind: "circuit"
  label: string
  mode: "amrap" | "rounds"
  rounds: number
  amrap?: { fullRounds: number; leftover: number; leftoverName: string }
  completionSeconds?: number
}
export type SessionCardItem = SessionCardSoloItem | SessionCardCircuitItem
export type SessionCardSessionFact = {
  id: string
  label: string
  finishedAtLabel: string
  durationLabel: string
  setsDone: number
}
export type SessionCardPayload = {
  locale: SessionCardLocale
  session: SessionCardSessionFact | null
  tonnageKg: number
  items: SessionCardItem[]
}

const emptyPayload = (locale: SessionCardLocale): SessionCardPayload => ({
  locale,
  session: null,
  tonnageKg: 0,
  items: [],
})

function numericReps(reps: string | null): number | null {
  const trimmed = reps?.trim() ?? ""
  if (trimmed === "") return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : null
}

function measureLabel(log: HistorySetLog): string {
  return log.duration_seconds != null
    ? `${log.duration_seconds}s`
    : `${numericReps(log.reps_logged) ?? 0} reps`
}

/** Port of `src/lib/sessionRowDuration.ts`: active ms, else wall-clock. */
function formatDuration(
  startedAt: string,
  finishedAt: string | null,
  activeDurationMs: number | null,
): string {
  if (!finishedAt) return "–"
  const ms =
    activeDurationMs != null && activeDurationMs >= 0
      ? activeDurationMs
      : new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  return `${h}h ${totalMin % 60}m`
}

function diffLocalCalendarDays(now: Date, then: Date): number {
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((startNow.getTime() - startThen.getTime()) / 86_400_000)
}

/** Port of `src/lib/formatters.ts#formatRelativeDate`. */
function formatRelativeDate(iso: string, locale: SessionCardLocale): string {
  const then = new Date(iso)
  const now = new Date()
  const days = Math.max(0, diffLocalCalendarDays(now, then))
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const raw = days < 7 ? fmt.format(-days, "day") : fmt.format(-Math.floor(days / 7), "week")
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function blockCells(group: BlockHistoryGroup): CompletionCell[] {
  return group.rounds.flatMap((round) =>
    round.cells.map((cell) => ({
      block_exercise_id: cell.blockExerciseId,
      set_number: cell.log.set_number,
      reps_logged: cell.log.reps_logged,
      duration_seconds: cell.log.duration_seconds,
      weight_logged: cell.log.weight_logged,
      logged_at: cell.log.logged_at,
    })),
  )
}

/** The tool's `locale` argument wins, then the athlete's stored locale, then English. */
export function resolveCardLocale(arg: unknown, profileLocale: unknown): SessionCardLocale {
  if (arg === "en" || arg === "fr") return arg
  if (profileLocale === "en" || profileLocale === "fr") return profileLocale
  return "en"
}

function toItem(
  item: SessionHistoryItem,
  modeByBlockId: Map<string, "rounds" | "amrap">,
  nameById: Map<string, string>,
): SessionCardItem {
  if (item.kind === "solo") {
    return {
      kind: "solo",
      name: nameById.get(item.key) ?? item.exercise_name_snapshot,
      sets: item.sets.map((log) => ({
        measure: measureLabel(log),
        weightKg: log.weight_logged,
        isPr: log.was_pr,
      })),
    }
  }
  const cells = blockCells(item)
  const mode = modeByBlockId.get(item.key) ?? "rounds"
  const base = { kind: "circuit" as const, label: item.label ?? "", mode, rounds: item.rounds.length }
  if (mode === "amrap" && item.amrapScore) {
    const leftover = item.rounds
      .flatMap((round) => round.cells)
      .reduce<BlockHistoryCell | null>((best, cell) => {
        if (best == null) return cell
        if (cell.log.set_number !== best.log.set_number) {
          return cell.log.set_number > best.log.set_number ? cell : best
        }
        return cell.log.logged_at > best.log.logged_at ? cell : best
      }, null)
    return {
      ...base,
      amrap: {
        fullRounds: item.amrapScore.fullRounds,
        leftover: item.amrapScore.leftover,
        leftoverName: (leftover && nameById.get(leftover.log.exercise_id)) ?? item.amrapScore.leftoverName,
      },
    }
  }
  if (isRunComplete(cells)) {
    return { ...base, completionSeconds: runCompletionSeconds(cells) }
  }
  return base
}

/**
 * Builds the Session Card wire payload for the athlete's most recent finished session,
 * reusing the Edge ports (`sessionHistoryGrouping`, `amrapScore`, `tonnage`). Returns an
 * honest empty payload when there is no finished session — never a fabricated zero.
 */
export async function buildSessionCardPayload(
  supabase: SupabaseClient,
  locale: SessionCardLocale = "en",
): Promise<SessionCardPayload> {
  const { data: sessions, error: sessionError } = await supabase
    .from("sessions")
    .select("id, workout_label_snapshot, started_at, finished_at, active_duration_ms, total_sets_done")
    .not("finished_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)

  if (sessionError) throw new Error(`sessions: ${sessionError.message}`)
  const session = sessions?.[0] as Record<string, unknown> | undefined
  if (!session) return emptyPayload(locale)

  const sessionId = String(session.id)

  const { data: setLogs, error: setError } = await supabase
    .from("set_logs")
    .select(
      "id, exercise_id, block_exercise_id, exercise_name_snapshot, set_number, reps_logged, duration_seconds, weight_logged, was_pr, logged_at",
    )
    .eq("session_id", sessionId)
    .order("set_number", { ascending: true })
    .returns<HistorySetLog[]>()

  if (setError) throw new Error(`set_logs: ${setError.message}`)
  const logs = setLogs ?? []

  const blockExerciseIds = [
    ...new Set(logs.map((log) => log.block_exercise_id).filter((id): id is string => id != null)),
  ]

  let metaRows: BlockExerciseMetaRow[] = []
  if (blockExerciseIds.length > 0) {
    const { data, error } = await supabase
      .from("block_exercises")
      .select("id, block_id, emoji_snapshot, position, block:exercise_blocks(id, label, rounds, sort_order, mode)")
      .in("id", blockExerciseIds)
    if (error) throw new Error(`block_exercises: ${error.message}`)
    metaRows = (data ?? []).map((row) => {
      const blockRaw = row.block
      const block = Array.isArray(blockRaw) ? (blockRaw[0] ?? null) : blockRaw
      return {
        id: row.id,
        block_id: row.block_id,
        emoji_snapshot: row.emoji_snapshot,
        position: row.position,
        block: block ?? null,
      }
    })
  }

  const metaById = buildBlockMetaMap(metaRows)
  const modeByBlockId = new Map<string, "rounds" | "amrap">()
  for (const meta of metaById.values()) modeByBlockId.set(meta.blockId, meta.mode)

  const { data: runRows, error: runError } = await supabase
    .from("block_runs")
    .select("session_id, block_id, finished_at, mode, started_at, template_fingerprint, benchmark_circuit_id")
    .eq("session_id", sessionId)
    .returns<HistoryBlockRun[]>()

  if (runError) throw new Error(`block_runs: ${runError.message}`)
  const runs = runRows ?? []

  const grouped = groupSessionHistory(logs, metaById)
  const items = attachAmrapScores(grouped, runs, sessionId)

  const nameById = new Map<string, string>()
  const exerciseIds = [...new Set(logs.map((log) => log.exercise_id))]
  if (exerciseIds.length > 0) {
    const { data, error } = await supabase
      .from("exercises")
      .select("id, name, name_en")
      .in("id", exerciseIds)
    if (error) throw new Error(`exercises: ${error.message}`)
    for (const row of data ?? []) {
      nameById.set(String(row.id), locale === "fr" ? String(row.name) : String(row.name_en ?? row.name))
    }
  }

  return {
    locale,
    session: {
      id: sessionId,
      label: String(session.workout_label_snapshot),
      finishedAtLabel: formatRelativeDate(
        String(session.finished_at ?? session.started_at),
        locale,
      ),
      durationLabel: formatDuration(
        String(session.started_at),
        (session.finished_at as string | null) ?? null,
        (session.active_duration_ms as number | null) ?? null,
      ),
      setsDone: Number(session.total_sets_done),
    },
    tonnageKg: Math.round(sessionTonnageKg(logs)),
    items: items.map((item) => toItem(item, modeByBlockId, nameById)),
  }
}
