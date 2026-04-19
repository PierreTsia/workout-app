import type { ToolDefinition } from "./registry.ts"
import { formatStatsSummary } from "../lib/format.ts"

export const getTrainingStats: ToolDefinition = {
  name: "get_training_stats",
  description:
    "Get training statistics for a period. Returns session count, training frequency, " +
    "volume breakdown by muscle group, and personal records. Defaults to the last 30 days.",
  inputSchema: {
    type: "object",
    properties: {
      days: {
        type: "number",
        minimum: 1,
        maximum: 365,
        description: "Lookback period in days (default 30).",
      },
      muscle_group: {
        type: "string",
        description: "Filter volume breakdown to a specific muscle group (French name, e.g. 'Dos', 'Pectoraux').",
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

    const days = (args.days as number | undefined) ?? 30
    const muscleGroupFilter = args.muscle_group as string | undefined

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return {
        content: [{ type: "text", text: "Could not identify the authenticated user." }],
        isError: true,
      }
    }
    const userId = userData.user.id

    const [volumeResult, prResult] = await Promise.all([
      supabase.rpc("get_volume_by_muscle_group", {
        p_user_id: userId,
        p_days: days,
        p_offset_days: 0,
      }),
      fetchPrs(supabase, days),
    ])

    if (volumeResult.error) {
      return {
        content: [{ type: "text", text: `Error fetching volume: ${volumeResult.error.message}` }],
        isError: true,
      }
    }

    const raw = volumeResult.data as { finished_sessions: number; muscles: Array<{ muscle_group: string; total_sets: number; total_volume_kg: number; exercise_count?: number }> } | null
    const sessionCount = raw?.finished_sessions ?? 0
    const muscles = (raw?.muscles ?? [])
      .filter((m) => !muscleGroupFilter || m.muscle_group.toLowerCase() === muscleGroupFilter.toLowerCase())

    if (sessionCount === 0) {
      return {
        content: [{ type: "text", text: `No training data found for the last ${days} days.` }],
      }
    }

    const prs = (prResult ?? []) as Array<{
      exercise_name_snapshot: string
      weight_logged: number
      reps_logged: string | null
      duration_seconds: number | null
      logged_at: string
    }>

    return {
      content: [{ type: "text", text: formatStatsSummary(days, sessionCount, muscles, prs) }],
    }
  },
}

async function fetchPrs(
  supabase: Parameters<ToolDefinition["handler"]>[1],
  days: number,
) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data, error } = await supabase!
    .from("set_logs")
    .select("exercise_name_snapshot, weight_logged, reps_logged, duration_seconds, logged_at")
    .eq("was_pr", true)
    .gte("logged_at", since)
    .order("logged_at", { ascending: false })
    .limit(20)

  if (error) return []
  return data ?? []
}
