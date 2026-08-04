import { bilingualExerciseLabel } from "../lib/bilingualName.ts"
import { formatWeightConvention, type WeightConvention } from "../lib/format.ts"
import {
  resolveEnglishInstructions,
  type ExerciseInstructions,
} from "../lib/resolveInstructions.ts"
import type { ToolDefinition } from "./registry.ts"

const WEIGHT_CONVENTION_HINT: Record<WeightConvention, string> = {
  per_hand: "each hand",
  total: "total load on the implement",
  bodyweight: "no external load",
}

function formatInstructions(raw: ExerciseInstructions | null): string {
  if (!raw) return "No instructions available."

  const sections = [
    raw.setup?.length && `**Setup**\n${raw.setup.map((s) => `- ${s}`).join("\n")}`,
    raw.movement?.length && `**Movement**\n${raw.movement.map((s) => `- ${s}`).join("\n")}`,
    raw.breathing?.length && `**Breathing**\n${raw.breathing.map((s) => `- ${s}`).join("\n")}`,
    raw.common_mistakes?.length && `**Common mistakes**\n${raw.common_mistakes.map((s) => `- ${s}`).join("\n")}`,
  ].filter(Boolean)

  return sections.join("\n\n")
}

function formatExercise(ex: Record<string, unknown>): string {
  const name = bilingualExerciseLabel(
    String(ex.name ?? ""),
    ex.name_en as string | null | undefined,
  )
  const secondary = (ex.secondary_muscles as string[] | null)?.join(", ")

  const equipment = (ex.equipment as string | null | undefined) ?? "other"
  const convention = formatWeightConvention(equipment)

  const meta = [
    `**Name:** ${name}`,
    `**Muscle group:** ${ex.muscle_group}`,
    secondary && `**Secondary muscles:** ${secondary}`,
    `**Equipment:** ${equipment}`,
    `**Weight convention:** ${convention} (${WEIGHT_CONVENTION_HINT[convention]})`,
    ex.difficulty_level && `**Difficulty:** ${ex.difficulty_level}`,
    ex.measurement_type === "duration"
      ? `**Measurement:** duration${ex.default_duration_seconds ? ` (${ex.default_duration_seconds}s default)` : ""}`
      : `**Measurement:** reps`,
  ].filter(Boolean).join("\n")

  const instructions = formatInstructions(
    resolveEnglishInstructions({
      instructions: ex.instructions as ExerciseInstructions | null,
      instructions_en: ex.instructions_en as ExerciseInstructions | null,
      instructions_en_status: ex.instructions_en_status as string | null,
    }),
  )

  const imageFullUrl = resolveImageUrl(ex.image_url as string | null)
  const links = [
    ex.youtube_url && `**Video:** ${ex.youtube_url}`,
    imageFullUrl && `**Image:** ${imageFullUrl}`,
  ].filter(Boolean).join("\n")

  return [meta, "", "---", "", instructions, links && `\n---\n\n${links}`]
    .filter(Boolean)
    .join("\n")
}

function resolveImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null
  if (imagePath.startsWith("http")) return imagePath
  const base = Deno.env.get("SUPABASE_URL")
  return base ? `${base}/storage/v1/object/public/exercise-media/${imagePath}` : imagePath
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const getExerciseDetails: ToolDefinition = {
  name: "get_exercise_details",
  annotations: {
    title: "Get exercise details",
    readOnlyHint: true,
    idempotentHint: true,
  },
  description:
    "Get full details for ONE exercise by its UUID. Returns instructions (setup, movement, " +
    "breathing, common mistakes), muscle targets, equipment, difficulty, and media links. " +
    "Instructions are English when a reviewed translation exists; otherwise French. " +
    "Use this when the user wants to LEARN about a specific exercise (form cues, video, " +
    "common mistakes) — NOT when building a program. " +
    "**To obtain the UUID, prefer `resolve_exercises` (one batch call by name, also bundles " +
    "`weight_convention` / `measurement_type` / `default_duration_seconds` if you go on to " +
    "`create_program` / `update_program`). Use `search_exercises` only when browsing the " +
    "catalog by filter without a specific name in mind.**",
  inputSchema: {
    type: "object",
    properties: {
      exercise_id: {
        type: "string",
        description: "UUID of the exercise. Obtain it from `resolve_exercises` (preferred — by name) or `search_exercises` (when browsing by filter).",
      },
    },
    required: ["exercise_id"],
  },

  async handler(args, supabase) {
    if (!supabase) {
      return {
        content: [{ type: "text", text: "Authentication required — please provide a valid Bearer token." }],
        isError: true,
      }
    }

    const exerciseId = args.exercise_id as string | undefined

    if (!exerciseId) {
      return {
        content: [{ type: "text", text: "exercise_id is required. Use `resolve_exercises` (by name, preferred) or `search_exercises` (browse by filter) to find the UUID." }],
        isError: true,
      }
    }

    if (!UUID_RE.test(exerciseId)) {
      return {
        content: [{ type: "text", text: `Invalid exercise_id format: "${exerciseId}". Expected a UUID — use \`resolve_exercises\` (by name) or \`search_exercises\` (browse) to find it.` }],
        isError: true,
      }
    }

    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", exerciseId)
      .single()

    if (error || !data) {
      return {
        content: [{ type: "text", text: `Exercise not found (id: ${exerciseId}). Try \`resolve_exercises\` with the name, or \`search_exercises\` to browse by filter.` }],
        isError: true,
      }
    }

    return { content: [{ type: "text", text: formatExercise(data as Record<string, unknown>) }] }
  },
}
