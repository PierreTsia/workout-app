import type { ToolDefinition } from "./registry.ts"
import { formatSessionSummary } from "../lib/format.ts"

export const getWorkoutHistory: ToolDefinition = {
  name: "get_workout_history",
  description:
    "Get the user's workout session history. Returns sessions with exercises, sets, reps, weights, " +
    "and PR flags. Filter by date range or exercise name. Defaults to the last 10 sessions.",
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
      .select("id, workout_label_snapshot, started_at, finished_at, active_duration_ms, total_sets_done")
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

    const sessionIds = sessions.map((s: Record<string, unknown>) => s.id as string)

    let setQuery = supabase
      .from("set_logs")
      .select("session_id, exercise_name_snapshot, set_number, reps_logged, duration_seconds, weight_logged, was_pr")
      .in("session_id", sessionIds)
      .order("set_number", { ascending: true })

    if (exerciseName) {
      setQuery = setQuery.ilike("exercise_name_snapshot", `%${exerciseName}%`)
    }

    const { data: setLogs, error: setErr } = await setQuery

    if (setErr) {
      return { content: [{ type: "text", text: `Error fetching set logs: ${setErr.message}` }], isError: true }
    }

    const setsBySession = new Map<string, Record<string, unknown>[]>()
    for (const s of (setLogs ?? []) as Record<string, unknown>[]) {
      const sid = s.session_id as string
      const existing = setsBySession.get(sid) ?? []
      existing.push(s)
      setsBySession.set(sid, existing)
    }

    // If filtering by exercise, drop sessions with no matching sets
    const relevantSessions = exerciseName
      ? (sessions as Record<string, unknown>[]).filter((s) => setsBySession.has(s.id as string))
      : (sessions as Record<string, unknown>[])

    if (relevantSessions.length === 0) {
      return {
        content: [{ type: "text", text: `No sessions found containing "${exerciseName}" in this period.` }],
      }
    }

    const blocks = relevantSessions.map((s) => {
      const sets = (setsBySession.get(s.id as string) ?? []) as Array<{
        exercise_name_snapshot: string
        set_number: number
        reps_logged: string | null
        duration_seconds: number | null
        weight_logged: number
        was_pr: boolean
      }>
      return formatSessionSummary(
        s as {
          workout_label_snapshot: string
          started_at: string
          finished_at: string | null
          active_duration_ms: number | null
          total_sets_done: number
        },
        sets,
      )
    })

    return {
      content: [{ type: "text", text: `## Workout History (${relevantSessions.length} sessions)\n\n${blocks.join("\n\n")}` }],
    }
  },
}
