import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { searchExercises } from "./searchExercises.ts"
import { getExerciseDetails } from "./getExerciseDetails.ts"

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

const tools: ToolDefinition[] = [searchExercises, getExerciseDetails]

export const toolRegistry = {
  list: () => tools.map(({ handler: _, ...schema }) => schema),
  get: (name: string) => tools.find((t) => t.name === name) ?? null,
}
