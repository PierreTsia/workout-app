import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.103.3"
import { exerciseCatalogSchema } from "./exerciseCatalogSchema.ts"

export interface ResourceDefinition {
  uri: string
  name: string
  description: string
  mimeType: string
  handler: (supabase: SupabaseClient | null) => Promise<{
    contents: Array<{ uri: string; mimeType: string; text: string }>
  }>
}

const resources: ResourceDefinition[] = [exerciseCatalogSchema]

export const resourceRegistry = {
  list: () => resources.map(({ handler: _, ...meta }) => meta),
  get: (uri: string) => resources.find((r) => r.uri === uri) ?? null,
}
