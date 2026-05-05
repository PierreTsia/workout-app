import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import { searchExercises } from "./searchExercises.ts"
import { resolveExercises } from "./resolveExercises.ts"
import { getExerciseDetails } from "./getExerciseDetails.ts"
import { getWorkoutHistory } from "./getWorkoutHistory.ts"
import { getTrainingStats } from "./getTrainingStats.ts"
import { getUpcomingWorkouts } from "./getUpcomingWorkouts.ts"
import { createProgram } from "./createProgram.ts"
import { updateProgram } from "./updateProgram.ts"
import { listPrograms } from "./listPrograms.ts"
import { getProgramDetails } from "./getProgramDetails.ts"

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
  handler: (
    args: Record<string, unknown>,
    supabase: SupabaseClient | null,
  ) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>
}

const tools: ToolDefinition[] = [
  searchExercises,
  resolveExercises,
  getExerciseDetails,
  getWorkoutHistory,
  getTrainingStats,
  getUpcomingWorkouts,
  createProgram,
  updateProgram,
  listPrograms,
  getProgramDetails,
]

export const toolRegistry = {
  list: () => tools.map(({ handler: _, ...schema }) => schema),
  get: (name: string) => tools.find((t) => t.name === name) ?? null,
}
