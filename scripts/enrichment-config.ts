/**
 * Central config and exclusion-set helper for Phase 1–3 enrichment scripts.
 * Phase scripts (enrich-youtube, enrich-illustrations, enrich-instructions) read
 * config from here or env; they never UPDATE the 23 hand-curated exercises.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { EXISTING_EXERCISE_MAP } from "./exercise-mapping.js"

// ---------- Env ----------

const env = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? undefined,
  /** Phase 2: Replicate or Hugging Face Inference API key */
  imageProviderKey: process.env.REPLICATE_API_TOKEN ?? process.env.HF_TOKEN ?? undefined,
  /** Phase 3: LLM API key if using hosted inference */
  llmApiKey: process.env.HF_TOKEN ?? undefined,
}

// ---------- Phase 1 — YouTube ----------

/** Language order for video search (FR then EN per T18). Configurable. */
export const LANGUAGE_ORDER: readonly string[] = ["fr", "en"]

export const phase1 = {
  languageOrder: [...LANGUAGE_ORDER],
  youtubeApiKey: env.youtubeApiKey,
  /** Path to allowlist CSV/JSON (curated channel or exercise → URL). Relative to cwd or absolute. */
  allowlistPath: process.env.ENRICHMENT_ALLOWLIST_PATH ?? "scripts/data/youtube-allowlist.csv",
} as const

// ---------- Phase 2 — Images ----------

export const phase2 = {
  /** "replicate" | "huggingface" — single provider for v1 */
  imageProvider: (process.env.ENRICHMENT_IMAGE_PROVIDER ?? "replicate") as "replicate" | "huggingface",
  imageProviderKey: env.imageProviderKey,
  /** Model id (e.g. FLUX or SDXL variant) */
  imageModel: process.env.ENRICHMENT_IMAGE_MODEL ?? "black-forest-labs/flux-schnell",
  /** Style / diversity: prompt constraints; no new DB columns */
  stylePromptPrefix: process.env.ENRICHMENT_STYLE_PROMPT ?? "clear form, minimal background, fitness illustration",
  /** Max images per minute when batching (rate limit) */
  batchDelayMs: Number(process.env.ENRICHMENT_IMAGE_BATCH_DELAY_MS) || 2000,
} as const

// ---------- Phase 3 — Instructions ----------

export const phase3 = {
  /** "llm" | "template" */
  mode: (process.env.ENRICHMENT_INSTRUCTIONS_MODE ?? "template") as "llm" | "template",
  llmApiKey: env.llmApiKey,
  /** Hugging Face Inference endpoint for LLM (if mode === "llm") */
  llmEndpoint: process.env.ENRICHMENT_LLM_ENDPOINT ?? undefined,
} as const

// ---------- Shared config export ----------

export const enrichmentConfig = {
  supabaseUrl: env.supabaseUrl,
  supabaseServiceRoleKey: env.supabaseServiceRoleKey,
  phase1,
  phase2,
  phase3,
} as const

// ---------- Exclusion-set helper ----------

/** The 23 hand-curated exercise names (source of truth for exclusion). */
export const EXCLUDED_EXERCISE_NAMES = Object.keys(EXISTING_EXERCISE_MAP)

/**
 * Loads the 23 exercise names from EXISTING_EXERCISE_MAP, queries Supabase
 * for exercises where name IN (...), and returns a Set of their IDs.
 * Phase scripts must exclude these IDs from any enrichment UPDATE.
 *
 * @param supabase - Supabase client (service role for scripts)
 * @returns Set of exercise UUIDs to exclude from enrichment
 */
export async function getExcludedExerciseIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  if (EXCLUDED_EXERCISE_NAMES.length === 0) return new Set()

  const { data, error } = await supabase
    .from("exercises")
    .select("id")
    .in("name", EXCLUDED_EXERCISE_NAMES)

  if (error) {
    throw new Error(`Failed to resolve excluded exercise IDs: ${error.message}`)
  }

  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (row?.id) ids.add(row.id)
  }
  return ids
}
