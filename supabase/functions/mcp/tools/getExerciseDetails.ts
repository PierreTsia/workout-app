import type { ToolDefinition } from "./registry.ts"

interface Instructions {
  setup?: string[]
  movement?: string[]
  breathing?: string[]
  common_mistakes?: string[]
}

function formatInstructions(raw: Instructions | null): string {
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
  const name = ex.name_en ? `${ex.name} (${ex.name_en})` : ex.name
  const secondary = (ex.secondary_muscles as string[] | null)?.join(", ")

  const meta = [
    `**Name:** ${name}`,
    `**Muscle group:** ${ex.muscle_group}`,
    secondary && `**Secondary muscles:** ${secondary}`,
    `**Equipment:** ${ex.equipment}`,
    ex.difficulty_level && `**Difficulty:** ${ex.difficulty_level}`,
    ex.measurement_type === "duration"
      ? `**Measurement:** duration${ex.default_duration_seconds ? ` (${ex.default_duration_seconds}s default)` : ""}`
      : `**Measurement:** reps`,
  ].filter(Boolean).join("\n")

  const instructions = formatInstructions(ex.instructions as Instructions | null)

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
  description:
    "Get full details for ONE exercise by its UUID. Returns instructions (setup, movement, " +
    "breathing, common mistakes), muscle targets, equipment, difficulty, and media links. " +
    "You MUST call search_exercises first to obtain the exercise_id. " +
    "search_exercises only returns the ID when there is a single match — if multiple results " +
    "come back, present the list to the user and let them pick before searching again.",
  inputSchema: {
    type: "object",
    properties: {
      exercise_id: {
        type: "string",
        description: "UUID of the exercise. Obtain this from search_exercises (only provided for single-match results).",
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
        content: [{ type: "text", text: "exercise_id is required. Use search_exercises first to find the UUID." }],
        isError: true,
      }
    }

    if (!UUID_RE.test(exerciseId)) {
      return {
        content: [{ type: "text", text: `Invalid exercise_id format: "${exerciseId}". Expected a UUID — use search_exercises to find it.` }],
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
        content: [{ type: "text", text: `Exercise not found (id: ${exerciseId}). Try search_exercises to find the right one.` }],
        isError: true,
      }
    }

    return { content: [{ type: "text", text: formatExercise(data as Record<string, unknown>) }] }
  },
}
