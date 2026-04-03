import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"

/** PostgREST URL limits — keep chunks conservative. */
const CHUNK_SIZE = 100

export async function fetchExercisesByIds(ids: string[]): Promise<Exercise[]> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return []

  const chunkCount = Math.ceil(unique.length / CHUNK_SIZE)
  const chunks = Array.from({ length: chunkCount }, (_, i) =>
    unique.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
  )

  const rows = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .in("id", chunk)
      if (error) throw error
      return data ?? []
    }),
  )

  return rows.flat() as Exercise[]
}
