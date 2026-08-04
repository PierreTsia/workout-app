import {
  assembleResolutionResults,
  type ResolvedExercise,
  type ResolvedQuery,
  type ResolveBatchRow,
} from "../lib/assembleResolution.ts"
import { formatBilingualExerciseName } from "../lib/bilingualName.ts"
import { resolveAmbiguityGap } from "../lib/scoreGap.ts"
import type { ToolDefinition } from "./registry.ts"

const MAX_BATCH_SIZE = 30

const TOOL_DESCRIPTION =
  "Resolve a batch of exercise names to catalog UUIDs in ONE round-trip. " +
  "Prefer this over `search_exercises` when you already know the names you want " +
  "(e.g. when building a program from a user request like \"bench press, squat, " +
  "overhead press\"). Returns the matched exercise plus everything needed to call " +
  "`create_program` (id, equipment, weight_convention, measurement_type, " +
  "default_duration_seconds), so you do NOT need to follow up with " +
  "`get_exercise_details` for these. " +
  "Each query yields one of four statuses: " +
  "\"matched\" (single clear winner), " +
  "\"ambiguous\" (top results are close — pick one or ask the user), " +
  "\"no_match\" (nothing similar enough — try search_exercises with broader filters), " +
  "\"empty_query\" (whitespace-only input)."

export const resolveExercises: ToolDefinition = {
  name: "resolve_exercises",
  annotations: {
    title: "Resolve exercise names to catalog ids",
    readOnlyHint: true,
    idempotentHint: true,
  },
  description: TOOL_DESCRIPTION,
  inputSchema: {
    type: "object",
    properties: {
      queries: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: MAX_BATCH_SIZE,
        description:
          `Up to ${MAX_BATCH_SIZE} exercise names (free-text, French or English, ` +
          "diacritic-insensitive). Each is resolved to its top catalog match plus " +
          "alternates if scores are close.",
      },
    },
    required: ["queries"],
  },

  async handler(args, supabase) {
    if (!supabase) {
      return {
        content: [{ type: "text", text: "Authentication required — please provide a valid Bearer token." }],
        isError: true,
      }
    }

    const queries = args.queries
    if (!Array.isArray(queries) || queries.length === 0) {
      return {
        content: [{
          type: "text",
          text: "queries must be a non-empty array of exercise names. Example: { \"queries\": [\"bench press\", \"squat\"] }.",
        }],
        isError: true,
      }
    }
    if (queries.length > MAX_BATCH_SIZE) {
      return {
        content: [{
          type: "text",
          text: `Too many queries (${queries.length}). Maximum is ${MAX_BATCH_SIZE} per call — split your request.`,
        }],
        isError: true,
      }
    }
    if (!queries.every((q) => typeof q === "string")) {
      return {
        content: [{
          type: "text",
          text: "Every queries[] entry must be a string. Example: { \"queries\": [\"bench press\", \"squat\"] }.",
        }],
        isError: true,
      }
    }

    const gap = resolveAmbiguityGap(Deno.env.get("MCP_AMBIGUITY_GAP"))

    const { data, error } = await supabase.rpc("resolve_exercises_batch", { queries })

    if (error) {
      return {
        content: [{ type: "text", text: `Error resolving exercises: ${error.message}` }],
        isError: true,
      }
    }

    const rows = (data ?? []) as ResolveBatchRow[]
    const results = assembleResolutionResults(queries, rows, gap)

    return { content: [{ type: "text", text: formatResolutionResults(results) }] }
  },
}

function formatResolutionResults(results: ResolvedQuery[]): string {
  const sections = results.map(formatResolvedQuery).join("\n\n")
  const summary = summarizeStatuses(results)
  const footer =
    "\n\n_Use the ids above directly with `create_program`. " +
    "No need to call `search_exercises` or `get_exercise_details` for these — " +
    "`weight_convention`, `measurement_type` and `default_duration_seconds` are already included._"
  return `Resolved ${results.length} ${results.length === 1 ? "query" : "queries"} (${summary}):\n\n${sections}${footer}`
}

function summarizeStatuses(results: ResolvedQuery[]): string {
  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  return Object.entries(counts)
    .map(([status, count]) => `${count} ${status}`)
    .join(", ")
}

function formatResolvedQuery(r: ResolvedQuery): string {
  const header = `## "${r.query}" → ${r.status}`
  if (r.status === "no_match") {
    return `${header}\n- No catalog match. Try \`search_exercises\` with broader filters or check spelling.`
  }
  if (r.status === "empty_query") {
    return `${header}\n- Empty/whitespace query — skipped.`
  }
  return `${header}\n${r.matches.map(formatMatch).join("\n")}`
}

function formatMatch(m: ResolvedExercise): string {
  const nameLine = formatBilingualExerciseName(m.name, m.name_en)
  const meta = [
    m.muscle_group,
    m.equipment,
    `weight_convention: ${m.weight_convention}`,
    m.measurement_type === "duration"
      ? `duration${m.default_duration_seconds ? ` (${m.default_duration_seconds}s default)` : ""}`
      : "reps",
  ].join(" | ")
  return `- ${nameLine} — ${meta}\n  - id: ${m.id} | score: ${m.score.toFixed(2)}`
}
