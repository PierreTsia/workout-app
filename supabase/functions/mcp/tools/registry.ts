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

/**
 * MCP-spec tool annotations (2025-03-26).
 *
 * Drives the client UI's auto-permission behavior:
 *   - read-only tools execute without confirmation prompts
 *   - destructive tools always prompt for user confirmation
 *
 * `title` is required so "added a tool, forgot the label" is a TS error at
 * the same line you're already editing. See ADR 0001 for the full matrix.
 */
export interface ToolAnnotations {
  /** Human-readable label shown in client UI (Claude Desktop, Cursor, etc.) */
  title: string
  /** True if the tool only reads data, never writes */
  readOnlyHint?: boolean
  /** True if the tool may delete or replace user data */
  destructiveHint?: boolean
  /** True if calling the tool multiple times with same args is safe */
  idempotentHint?: boolean
}

export interface ToolDefinition {
  name: string
  description: string
  annotations: ToolAnnotations
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
