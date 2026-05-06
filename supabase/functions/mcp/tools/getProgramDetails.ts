import type { ToolDefinition } from "./registry.ts"
import { formatProgramDetails } from "../lib/format.ts"
import { isUuid } from "../lib/uuid.ts"

interface ProgramRow {
  id: string
  name: string
  archived_at: string | null
  workout_days: WorkoutDayRow[] | null
}

interface WorkoutDayRow {
  id: string
  label: string
  emoji: string
  sort_order: number
  workout_exercises: WorkoutExerciseRow[] | null
}

interface WorkoutExerciseRow {
  id: string
  exercise_id: string
  name_snapshot: string
  sets: number
  reps: string
  weight: string
  rest_seconds: number
  target_duration_seconds: number | null
  sort_order: number
}

export const getProgramDetails: ToolDefinition = {
  name: "get_program_details",
  annotations: {
    title: "Get program details",
    readOnlyHint: true,
    idempotentHint: true,
  },
  description:
    "Get the full structure of a training program by ID — days, exercises, sets, reps, weights, rest. " +
    "Works regardless of cycle state. Use after list_programs, or with the program_id surfaced by " +
    "get_upcoming_workouts / get_workout_history. Returns markdown with inline IDs on day and exercise " +
    "lines for downstream addressability.",
  inputSchema: {
    type: "object",
    required: ["program_id"],
    properties: {
      program_id: {
        type: "string",
        description: "UUID of the program to fetch (obtained from list_programs or any tool that surfaces program ids).",
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

    const programId = String(args.program_id ?? "")

    if (!isUuid(programId)) {
      return {
        content: [{ type: "text", text: "Invalid program_id format (expected UUID)." }],
        isError: true,
      }
    }

    const { data, error } = await supabase
      .from("programs")
      .select(
        "id, name, archived_at, workout_days(id, label, emoji, sort_order, workout_exercises(id, exercise_id, name_snapshot, sets, reps, weight, rest_seconds, target_duration_seconds, sort_order))",
      )
      .eq("id", programId)
      .maybeSingle()

    if (error) {
      return {
        content: [{ type: "text", text: `Error fetching program: ${error.message}` }],
        isError: true,
      }
    }

    if (!data) {
      return {
        content: [{ type: "text", text: "Program not found or you don't have access." }],
        isError: true,
      }
    }

    const program = data as unknown as ProgramRow
    const days = (program.workout_days ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)

    const exercisesByDay = new Map(
      days.map((day) => {
        const sortedExercises = (day.workout_exercises ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
        return [day.id, sortedExercises]
      }),
    )

    const text = formatProgramDetails(
      { id: program.id, name: program.name, archived_at: program.archived_at },
      days.map(({ id, label, emoji, sort_order }) => ({ id, label, emoji, sort_order })),
      exercisesByDay,
    )

    return {
      content: [{ type: "text", text }],
    }
  },
}
