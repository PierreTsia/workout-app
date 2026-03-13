import { describe, it, expect } from "vitest"
import {
  EXCLUDED_EXERCISE_NAMES,
  getExcludedExerciseIds,
  enrichmentConfig,
  phase1,
  phase2,
  phase3,
} from "./enrichment-config.js"

describe("EXCLUDED_EXERCISE_NAMES", () => {
  it("has 23 names from EXISTING_EXERCISE_MAP", () => {
    expect(EXCLUDED_EXERCISE_NAMES).toHaveLength(23)
    expect(EXCLUDED_EXERCISE_NAMES).toContain("Développé couché")
    expect(EXCLUDED_EXERCISE_NAMES).toContain("Soulevé de terre roumain")
  })
})

describe("getExcludedExerciseIds", () => {
  it("returns Set of IDs returned by Supabase for the 23 names", async () => {
    const fakeIds = ["id-1", "id-2", "id-3"]
    const mockSupabase = {
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: fakeIds.map((id) => ({ id })), error: null }),
        }),
      }),
    } as unknown as Parameters<typeof getExcludedExerciseIds>[0]

    const result = await getExcludedExerciseIds(mockSupabase)
    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(3)
    expect(result.has("id-1")).toBe(true)
    expect(result.has("id-2")).toBe(true)
    expect(result.has("id-3")).toBe(true)
  })

  it("returns empty Set when Supabase returns no rows", async () => {
    const mockSupabaseEmpty = {
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as unknown as Parameters<typeof getExcludedExerciseIds>[0]

    const result = await getExcludedExerciseIds(mockSupabaseEmpty)
    expect(result.size).toBe(0)
  })

  it("throws when Supabase returns an error", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          in: () => Promise.resolve({ data: null, error: { message: "Network error" } }),
        }),
      }),
    } as unknown as Parameters<typeof getExcludedExerciseIds>[0]

    await expect(getExcludedExerciseIds(mockSupabase)).rejects.toThrow("Failed to resolve excluded exercise IDs")
  })
})

describe("enrichment config", () => {
  it("exports phase1 with language order and allowlist path", () => {
    expect(phase1.languageOrder).toEqual(["fr", "en"])
    expect(phase1.allowlistPath).toBeDefined()
  })

  it("exports phase2 with image provider and model", () => {
    expect(phase2.imageProvider).toBeDefined()
    expect(phase2.imageModel).toBeDefined()
    expect(phase2.batchDelayMs).toBeGreaterThan(0)
  })

  it("exports phase3 with mode", () => {
    expect(phase3.mode).toBeDefined()
  })

  it("exports enrichmentConfig with supabase env and phases", () => {
    expect(enrichmentConfig.phase1).toBe(phase1)
    expect(enrichmentConfig.phase2).toBe(phase2)
    expect(enrichmentConfig.phase3).toBe(phase3)
  })
})
