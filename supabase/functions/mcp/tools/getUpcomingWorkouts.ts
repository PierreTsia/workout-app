import type { ToolDefinition } from "./registry.ts"
import { formatWorkoutDay } from "../lib/format.ts"

export const getUpcomingWorkouts: ToolDefinition = {
  name: "get_upcoming_workouts",
  description:
    "See the user's upcoming programmed workouts. Returns the next training days with exercises, " +
    "target sets, reps, and weights. Requires an active program and cycle.",
  inputSchema: {
    type: "object",
    properties: {
      num_days: {
        type: "number",
        minimum: 1,
        maximum: 7,
        description: "How many upcoming workout days to show (default 3, max 7).",
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

    const numDays = Math.min((args.num_days as number | undefined) ?? 3, 7)

    // 1. Active program
    const { data: program, error: progErr } = await supabase
      .from("programs")
      .select("id, name")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    if (progErr) {
      return { content: [{ type: "text", text: `Error fetching program: ${progErr.message}` }], isError: true }
    }

    if (!program) {
      return {
        content: [{ type: "text", text: "No active program found. Create one in the Workout Builder to see upcoming workouts." }],
      }
    }

    // 2. Active cycle
    const { data: cycle, error: cycleErr } = await supabase
      .from("cycles")
      .select("id")
      .eq("program_id", program.id)
      .is("finished_at", null)
      .limit(1)
      .maybeSingle()

    if (cycleErr) {
      return { content: [{ type: "text", text: `Error fetching cycle: ${cycleErr.message}` }], isError: true }
    }

    if (!cycle) {
      return {
        content: [{ type: "text", text: `No active training cycle for "${program.name}". Start a new cycle to see upcoming workouts.` }],
      }
    }

    // 3. Workout days for this program
    const { data: days, error: daysErr } = await supabase
      .from("workout_days")
      .select("id, label, emoji, sort_order")
      .eq("program_id", program.id)
      .order("sort_order", { ascending: true })

    if (daysErr || !days?.length) {
      return {
        content: [{ type: "text", text: "No workout days defined in the active program." }],
      }
    }

    // 4. Count completed sessions in this cycle to find where we are
    const { count: completedCount, error: countErr } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("cycle_id", cycle.id)
      .not("finished_at", "is", null)

    if (countErr) {
      return { content: [{ type: "text", text: `Error counting sessions: ${countErr.message}` }], isError: true }
    }

    const nextIndex = (completedCount ?? 0) % days.length

    // 5. Pick the next N days (wrapping around)
    const upcomingDays = Array.from({ length: numDays }, (_, i) =>
      days[(nextIndex + i) % days.length] as { id: string; label: string; emoji: string; sort_order: number },
    )

    const dayIds = upcomingDays.map((d) => d.id)

    // 6. Fetch workout exercises for those days
    const { data: exercises, error: exErr } = await supabase
      .from("workout_exercises")
      .select("workout_day_id, name_snapshot, sets, reps, weight, rest_seconds, target_duration_seconds, sort_order")
      .in("workout_day_id", dayIds)
      .order("sort_order", { ascending: true })

    if (exErr) {
      return { content: [{ type: "text", text: `Error fetching exercises: ${exErr.message}` }], isError: true }
    }

    const exByDay = new Map<string, Record<string, unknown>[]>()
    for (const ex of (exercises ?? []) as Record<string, unknown>[]) {
      const dayId = ex.workout_day_id as string
      const existing = exByDay.get(dayId) ?? []
      existing.push(ex)
      exByDay.set(dayId, existing)
    }

    const blocks = upcomingDays.map((day, i) => {
      const dayExercises = (exByDay.get(day.id) ?? []) as Array<{
        name_snapshot: string
        sets: number
        reps: string
        weight: string
        rest_seconds: number
        target_duration_seconds?: number | null
      }>
      const prefix = i === 0 ? "**Next up →** " : ""
      return prefix + formatWorkoutDay(day, dayExercises)
    })

    return {
      content: [{
        type: "text",
        text: `## Upcoming Workouts — ${program.name}\n\n${blocks.join("\n\n")}`,
      }],
    }
  },
}
