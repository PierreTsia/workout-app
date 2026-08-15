import { unwrapCatalogNameEmbed, type CatalogNameEmbed } from "../lib/bilingualName.ts"
import {
  mergeDaySequence,
  type DbBlockForRead,
  type DbSoloForRead,
} from "../lib/daySequenceRead.ts"
import { formatWorkoutDay } from "../lib/format.ts"
import type { ToolDefinition } from "./registry.ts"

export const getUpcomingWorkouts: ToolDefinition = {
  name: "get_upcoming_workouts",
  annotations: {
    title: "Get upcoming workouts",
    readOnlyHint: true,
    idempotentHint: true,
  },
  description:
    "See the user's upcoming programmed workouts. Returns the next training days with exercises " +
    "and Circuits, target sets, reps, and weights. Requires an active program and cycle.",
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

    // 6. Fetch solos + Circuits for those days
    type UpcomingExerciseRow = {
      workout_day_id: string
      exercise_id: string
      name_snapshot: string
      sets: number
      reps: string
      weight: string
      rest_seconds: number
      target_duration_seconds?: number | null
      sort_order: number
      exercises: CatalogNameEmbed | CatalogNameEmbed[] | null
    }

    type UpcomingBlockRow = {
      id: string
      workout_day_id: string
      label: string | null
      rounds: number
      rest_seconds: number
      transition_seconds: number
      sort_order: number
      mode: "rounds" | "amrap"
      cap_seconds: number | null
      block_exercises: {
        exercise_id: string
        name_snapshot: string
        position: number
        per_round: { amount: number; weight: number }[]
        exercises: CatalogNameEmbed | CatalogNameEmbed[] | null
      }[] | null
    }

    const { data: exercises, error: exErr } = await supabase
      .from("workout_exercises")
      .select(
        "workout_day_id, exercise_id, name_snapshot, sets, reps, weight, rest_seconds, target_duration_seconds, sort_order, exercises(name, name_en)",
      )
      .in("workout_day_id", dayIds)
      .order("sort_order", { ascending: true })
      .returns<UpcomingExerciseRow[]>()

    if (exErr) {
      return { content: [{ type: "text", text: `Error fetching exercises: ${exErr.message}` }], isError: true }
    }

    const { data: blocks, error: blockErr } = await supabase
      .from("exercise_blocks")
      .select(
        "id, workout_day_id, label, rounds, rest_seconds, transition_seconds, sort_order, mode, cap_seconds, " +
          "block_exercises(exercise_id, name_snapshot, position, per_round, exercises(name, name_en))",
      )
      .in("workout_day_id", dayIds)
      .order("sort_order", { ascending: true })
      .returns<UpcomingBlockRow[]>()

    if (blockErr) {
      return { content: [{ type: "text", text: `Error fetching Circuits: ${blockErr.message}` }], isError: true }
    }

    const soloRows = (exercises ?? []).map((ex) => {
      const catalog = unwrapCatalogNameEmbed(ex.exercises)
      return {
        workout_day_id: ex.workout_day_id,
        solo: {
          exercise_id: ex.exercise_id,
          name_snapshot: ex.name_snapshot,
          name: catalog?.name ?? null,
          name_en: catalog?.name_en ?? null,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          rest_seconds: ex.rest_seconds,
          target_duration_seconds: ex.target_duration_seconds ?? null,
          sort_order: ex.sort_order,
        } satisfies DbSoloForRead,
      }
    })

    const blockRows = (blocks ?? []).map((block) => ({
      workout_day_id: block.workout_day_id,
      block: {
        id: block.id,
        label: block.label,
        rounds: block.rounds,
        rest_seconds: block.rest_seconds,
        transition_seconds: block.transition_seconds,
        sort_order: block.sort_order,
        mode: block.mode,
        cap_seconds: block.cap_seconds,
        block_exercises: (block.block_exercises ?? []).map((be) => {
          const catalog = unwrapCatalogNameEmbed(be.exercises)
          return {
            exercise_id: be.exercise_id,
            name_snapshot: be.name_snapshot,
            position: be.position,
            per_round: be.per_round,
            exercises: catalog
              ? { name: catalog.name, name_en: catalog.name_en }
              : null,
          }
        }),
      } satisfies DbBlockForRead,
    }))

    const dayBlocks = upcomingDays.map((day, i) => {
      const sequence = mergeDaySequence(
        soloRows.filter((r) => r.workout_day_id === day.id).map((r) => r.solo),
        blockRows.filter((r) => r.workout_day_id === day.id).map((r) => r.block),
      )
      const prefix = i === 0 ? "**Next up →** " : ""
      return prefix + formatWorkoutDay(day, [], sequence)
    })

    return {
      content: [{
        type: "text",
        text: `## Upcoming Workouts — ${program.name} *(id: ${program.id})*\n\n${dayBlocks.join("\n\n")}`,
      }],
    }
  },
}
