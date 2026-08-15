import { formatSessionHistory } from "../lib/format.ts"
import {
  buildBlockMetaMap,
  type BlockExerciseMetaRow,
  type HistoryBlockRun,
} from "../lib/sessionHistoryGrouping.ts"
import type { ToolDefinition } from "./registry.ts"

type SetLogRow = {
  id: string
  session_id: string
  exercise_id: string
  block_exercise_id: string | null
  exercise_name_snapshot: string
  set_number: number
  reps_logged: string | null
  duration_seconds: number | null
  weight_logged: number
  was_pr: boolean
  logged_at: string
}

export const getWorkoutHistory: ToolDefinition = {
  name: "get_workout_history",
  annotations: {
    title: "Get workout history",
    readOnlyHint: true,
    idempotentHint: true,
  },
  description:
    "Get the user's workout session history. Returns sessions with exercises, Circuits (round-major), " +
    "sets, reps, weights, and PR flags. Filter by date range or exercise name. Defaults to the last 10 sessions. " +
    "WEIGHT CONVENTION: weight_logged is per-hand for unilateral equipment (dumbbells, kettlebells); " +
    "multiply by 2 for total load and volume. Barbells, machines, plate-loaded, and cables are total. " +
    "Bodyweight is 0 (exclude from volume). Always check `equipment` via get_exercise_details before " +
    "computing volume.",
  inputSchema: {
    type: "object",
    properties: {
      from_date: {
        type: "string",
        description: "Start date (ISO 8601, e.g. 2026-04-01). Omit to use no lower bound.",
      },
      to_date: {
        type: "string",
        description: "End date (ISO 8601). Defaults to today.",
      },
      exercise_name: {
        type: "string",
        description: "Filter to sessions containing this exercise (fuzzy match on snapshot name).",
      },
      limit: {
        type: "number",
        minimum: 1,
        maximum: 50,
        description: "Max sessions to return (default 10, max 50).",
      },
    },
  },

  async handler(args, supabase) {
    if (!supabase) {
      return {
        content: [{ type: "text", text: "Authentication required — please provide a valid Bearer token." }],
        isError: true,
      }
    }

    const limit = Math.min((args.limit as number | undefined) ?? 10, 50)
    const toDate = (args.to_date as string | undefined) ?? new Date().toISOString().slice(0, 10)
    const fromDate = args.from_date as string | undefined
    const exerciseName = args.exercise_name as string | undefined

    let sessionQuery = supabase
      .from("sessions")
      .select(
        "id, workout_label_snapshot, started_at, finished_at, active_duration_ms, total_sets_done, cycle:cycles(program:programs(id, name))",
      )
      .not("finished_at", "is", null)
      .lte("started_at", `${toDate}T23:59:59Z`)
      .order("started_at", { ascending: false })
      .limit(limit)

    if (fromDate) {
      sessionQuery = sessionQuery.gte("started_at", `${fromDate}T00:00:00Z`)
    }

    const { data: sessions, error: sessErr } = await sessionQuery

    if (sessErr) {
      return { content: [{ type: "text", text: `Error fetching sessions: ${sessErr.message}` }], isError: true }
    }

    if (!sessions?.length) {
      return {
        content: [{ type: "text", text: "No workout sessions found for this period. Start logging workouts in the app!" }],
      }
    }

    const sessionIds = sessions.map((s: { id: string }) => s.id)

    let setQuery = supabase
      .from("set_logs")
      .select(
        "id, session_id, exercise_id, block_exercise_id, exercise_name_snapshot, set_number, reps_logged, duration_seconds, weight_logged, was_pr, logged_at",
      )
      .in("session_id", sessionIds)
      .order("set_number", { ascending: true })

    if (exerciseName) {
      setQuery = setQuery.ilike("exercise_name_snapshot", `%${exerciseName}%`)
    }

    const { data: setLogs, error: setErr } = await setQuery.returns<SetLogRow[]>()

    if (setErr) {
      return { content: [{ type: "text", text: `Error fetching set logs: ${setErr.message}` }], isError: true }
    }

    const logs = setLogs ?? []
    const blockExerciseIds = [
      ...new Set(
        logs
          .map((s) => s.block_exercise_id)
          .filter((id): id is string => id != null),
      ),
    ]

    let metaRows: BlockExerciseMetaRow[] = []
    if (blockExerciseIds.length > 0) {
      const { data: metaData, error: metaErr } = await supabase
        .from("block_exercises")
        .select(
          "id, block_id, emoji_snapshot, position, block:exercise_blocks(id, label, rounds, sort_order, mode)",
        )
        .in("id", blockExerciseIds)

      if (metaErr) {
        return {
          content: [{ type: "text", text: `Error fetching Circuit metadata: ${metaErr.message}` }],
          isError: true,
        }
      }
      // Embed typing: many-to-one is an object at runtime; generated types often say T[].
      metaRows = (metaData ?? []).map((row) => {
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

    const { data: runRows, error: runErr } = await supabase
      .from("block_runs")
      .select("session_id, block_id, finished_at, mode")
      .in("session_id", sessionIds)
      .returns<HistoryBlockRun[]>()

    if (runErr) {
      return {
        content: [{ type: "text", text: `Error fetching Block Runs: ${runErr.message}` }],
        isError: true,
      }
    }

    const blockRuns = runRows ?? []

    const setsBySession = logs.reduce((acc, s) => {
      const existing = acc.get(s.session_id) ?? []
      return acc.set(s.session_id, [...existing, s])
    }, new Map<string, SetLogRow[]>())

    // If filtering by exercise, drop sessions with no matching sets
    const relevantSessions = exerciseName
      ? sessions.filter((s: { id: string }) => setsBySession.has(s.id))
      : sessions

    if (relevantSessions.length === 0) {
      return {
        content: [{ type: "text", text: `No sessions found containing "${exerciseName}" in this period.` }],
      }
    }

    const blocks = relevantSessions.map((s: Record<string, unknown>) => {
      const sessionId = String(s.id)
      const sessionLogs = setsBySession.get(sessionId) ?? []
      const cycle = s.cycle as { program?: { id: string; name: string } | null } | null
      const program = cycle?.program ?? null
      const programInfo = program ? { id: program.id, name: program.name } : undefined
      return formatSessionHistory(
        {
          id: sessionId,
          workout_label_snapshot: String(s.workout_label_snapshot),
          started_at: String(s.started_at),
          finished_at: (s.finished_at as string | null) ?? null,
          active_duration_ms: (s.active_duration_ms as number | null) ?? null,
          total_sets_done: Number(s.total_sets_done),
        },
        sessionLogs,
        metaById,
        blockRuns,
        programInfo,
      )
    })

    return {
      content: [{ type: "text", text: `## Workout History (${relevantSessions.length} sessions)\n\n${blocks.join("\n\n")}` }],
    }
  },
}
