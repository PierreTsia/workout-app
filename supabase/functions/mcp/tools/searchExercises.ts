import type { ToolDefinition } from "./registry.ts"

const MUSCLE_GROUP_ALIASES: Record<string, string> = {
  abs: "Abdos",
  abdominals: "Abdos",
  biceps: "Biceps",
  "rear delts": "Deltoïdes post.",
  "rear deltoids": "Deltoïdes post.",
  "posterior deltoids": "Deltoïdes post.",
  back: "Dos",
  shoulders: "Épaules",
  delts: "Épaules",
  deltoids: "Épaules",
  glutes: "Fessiers",
  hamstrings: "Ischios",
  "hamstrings / lower back": "Ischios / Bas du dos",
  "lower back": "Lombaires",
  calves: "Mollets",
  chest: "Pectoraux",
  pecs: "Pectoraux",
  quads: "Quadriceps",
  quadriceps: "Quadriceps",
  traps: "Trapèzes",
  trapezius: "Trapèzes",
  triceps: "Triceps",
}

const BODY_REGION_ALIASES: Record<string, string[]> = {
  upper_body: ["Pectoraux", "Dos", "Épaules", "Biceps", "Triceps", "Trapèzes", "Deltoïdes post."],
  lower_body: ["Quadriceps", "Ischios", "Fessiers", "Mollets", "Ischios / Bas du dos"],
  push: ["Pectoraux", "Épaules", "Triceps"],
  pull: ["Dos", "Biceps", "Trapèzes", "Deltoïdes post."],
  arms: ["Biceps", "Triceps"],
  legs: ["Quadriceps", "Ischios", "Fessiers", "Mollets"],
  core: ["Abdos", "Lombaires"],
}

const VALID_MUSCLE_GROUPS = [
  "Abdos", "Biceps", "Deltoïdes post.", "Dos", "Épaules",
  "Fessiers", "Ischios", "Ischios / Bas du dos", "Lombaires",
  "Mollets", "Pectoraux", "Quadriceps", "Trapèzes", "Triceps",
]

function resolveMuscleGroups(input: string | string[]): string[] | undefined {
  const inputs = Array.isArray(input) ? input : [input]
  const resolved: string[] = []
  const unknown: string[] = []

  for (const raw of inputs) {
    const lower = raw.toLowerCase().trim()

    const region = BODY_REGION_ALIASES[lower]
    if (region) {
      resolved.push(...region)
      continue
    }

    const alias = MUSCLE_GROUP_ALIASES[lower]
    if (alias) {
      resolved.push(alias)
      continue
    }

    const exact = VALID_MUSCLE_GROUPS.find((v) => v.toLowerCase() === lower)
    if (exact) {
      resolved.push(exact)
      continue
    }

    unknown.push(raw)
  }

  if (unknown.length > 0) return undefined

  return [...new Set(resolved)]
}

export const searchExercises: ToolDefinition = {
  name: "search_exercises",
  description:
    "Search the exercise catalog by name, muscle group, equipment, or difficulty. " +
    "Supports fuzzy matching and diacritic-insensitive search in both French and English. " +
    "Use this to find exercises before getting full details with get_exercise_details.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Free-text search term (exercise name in French or English). Leave empty to browse by filters.",
      },
      muscle_group: {
        oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
        description:
          "Filter by muscle group(s). Accepts a single value or an array. " +
          "Body regions: upper_body, lower_body, push, pull, arms, legs, core. " +
          "Specific groups (EN): chest, back, shoulders, biceps, triceps, quads, hamstrings, " +
          "glutes, calves, abs, traps, rear delts, lower back. " +
          "Specific groups (FR): Pectoraux, Dos, Épaules, Biceps, Triceps, Quadriceps, " +
          "Ischios, Fessiers, Mollets, Abdos, Trapèzes, Deltoïdes post., Lombaires.",
      },
      equipment: {
        type: "array",
        items: { type: "string" },
        description:
          "Filter by equipment type(s): barbell, dumbbell, cable, machine, ez_bar, bodyweight.",
      },
      difficulty: {
        type: "array",
        items: { type: "string" },
        description:
          "Filter by difficulty level(s): beginner, intermediate, advanced.",
      },
      limit: {
        type: "number",
        minimum: 1,
        maximum: 50,
        description: "Max results per muscle group (default 20, max 50). Total results may exceed this when querying multiple groups.",
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

    const limit = (args.limit as number | undefined) ?? 20
    const equipment = args.equipment as string[] | undefined
    const difficulty = args.difficulty as string[] | undefined
    const rawMuscleGroup = args.muscle_group as string | string[] | undefined

    const muscleGroups = rawMuscleGroup
      ? resolveMuscleGroups(rawMuscleGroup)
      : undefined

    if (rawMuscleGroup && !muscleGroups) {
      const input = Array.isArray(rawMuscleGroup) ? rawMuscleGroup.join(", ") : rawMuscleGroup
      return {
        content: [{
          type: "text",
          text: `Unknown muscle group in "${input}". Valid values: ${VALID_MUSCLE_GROUPS.join(", ")}. ` +
            `Body regions: ${Object.keys(BODY_REGION_ALIASES).join(", ")}.`,
        }],
        isError: true,
      }
    }

    const searchTerm = ((args.query as string) ?? "").trim()

    // Fan out one RPC call per muscle group and merge results
    const groups = muscleGroups ?? [undefined]
    const results = await Promise.all(
      groups.map((mg) =>
        supabase.rpc("search_exercises", {
          search_term: searchTerm,
          filter_muscle_group: mg,
          filter_equipment: equipment?.length ? equipment : undefined,
          filter_difficulty: difficulty?.length ? difficulty : undefined,
          page_offset: 0,
          page_limit: mg ? limit : limit,
        }),
      ),
    )

    const firstError = results.find((r) => r.error)
    if (firstError?.error) {
      return {
        content: [{ type: "text", text: `Error searching exercises: ${firstError.error.message}` }],
        isError: true,
      }
    }

    // Deduplicate by exercise id across groups
    const seen = new Set<string>()
    const exercises = results
      .flatMap((r) => (r.data ?? []) as Record<string, unknown>[])
      .filter((ex) => {
        const id = ex.id as string
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })

    if (exercises.length === 0) {
      const filters = [
        searchTerm && `query "${searchTerm}"`,
        rawMuscleGroup && `muscle group "${Array.isArray(rawMuscleGroup) ? rawMuscleGroup.join(", ") : rawMuscleGroup}"`,
        equipment?.length && `equipment [${equipment.join(", ")}]`,
        difficulty?.length && `difficulty [${difficulty.join(", ")}]`,
      ].filter(Boolean)

      return {
        content: [{
          type: "text",
          text: filters.length
            ? `No exercises found matching ${filters.join(", ")}. Try broadening your search.`
            : "No exercises found.",
        }],
      }
    }

    const lines = exercises.map((ex, i) => {
      const parts = [
        `${i + 1}. **${ex.name}**`,
        ex.name_en ? `(${ex.name_en})` : null,
        `— ${ex.muscle_group}`,
        ex.equipment && ex.equipment !== "bodyweight" ? `| ${ex.equipment}` : null,
        ex.difficulty_level ? `| ${ex.difficulty_level}` : null,
      ]
      return parts.filter(Boolean).join(" ")
    })

    const groupLabel = muscleGroups && muscleGroups.length > 1
      ? ` across ${muscleGroups.length} muscle groups`
      : ""

    return {
      content: [{ type: "text", text: `Found ${exercises.length} exercises${groupLabel}:\n\n${lines.join("\n")}` }],
    }
  },
}
