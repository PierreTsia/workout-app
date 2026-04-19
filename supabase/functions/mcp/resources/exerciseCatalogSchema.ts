import type { ResourceDefinition } from "./registry.ts"

export const exerciseCatalogSchema: ResourceDefinition = {
  uri: "gymlogic://exercise-catalog-schema",
  name: "Exercise Catalog Schema",
  description:
    "Exercise catalog taxonomy: available muscle groups, equipment types, and difficulty levels. " +
    "Read this once to understand the domain vocabulary before using search_exercises or get_exercise_details.",
  mimeType: "application/json",

  async handler(supabase) {
    const uri = "gymlogic://exercise-catalog-schema"
    const mimeType = "application/json"

    if (!supabase) {
      return {
        contents: [{
          uri,
          mimeType,
          text: JSON.stringify({ error: "Authentication required — please provide a valid Bearer token." }),
        }],
      }
    }

    const { data, error } = await supabase.rpc("get_exercise_filter_options")

    if (error) {
      return {
        contents: [{
          uri,
          mimeType,
          text: JSON.stringify({ error: `Error fetching catalog schema: ${error.message}` }),
        }],
      }
    }

    return {
      contents: [{
        uri,
        mimeType,
        text: JSON.stringify(data, null, 2),
      }],
    }
  },
}
