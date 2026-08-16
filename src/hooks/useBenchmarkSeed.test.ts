import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { useBenchmarkSeed } from "./useBenchmarkSeed"

const CINDY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const PULL_ID = "11111111-1111-4111-8111-111111111111"

function makeCindyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CINDY_ID,
    slug: "cindy",
    label: "Cindy",
    rx: {
      mode: "amrap",
      cap_seconds: 1200,
      exercises: [{ exercise_id: PULL_ID, amount: 5, weight: 0 }],
    },
    tagline_fr: "Le WOD de Tom Holland.",
    tagline_en: "Tom Holland’s WOD.",
    story_fr: "Cinq tractions.",
    story_en: "Five pull-ups.",
    reference: { name: "Tom Holland", score: "27" },
    ...overrides,
  }
}

const eqCalls: { column: string; value: unknown }[] = []
const isCalls: { column: string; value: unknown }[] = []
const selectCalls: string[] = []
let catalogRow: unknown = null

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: unknown) => {
          if (table !== "benchmark_circuits") {
            throw new Error(`unexpected table ${table}`)
          }
          selectCalls.push(columns)
          eqCalls.push({ column, value })
          return {
            is: (isColumn: string, isValue: unknown) => {
              isCalls.push({ column: isColumn, value: isValue })
              return {
                maybeSingle: () => Promise.resolve({ data: catalogRow, error: null }),
              }
            },
          }
        },
      }),
    }),
  },
}))

describe("useBenchmarkSeed", () => {
  beforeEach(() => {
    eqCalls.length = 0
    isCalls.length = 0
    selectCalls.length = 0
    catalogRow = null
  })

  it("loads a GymLogic seed by slug and owner_id IS NULL", async () => {
    catalogRow = makeCindyRow()

    const { result } = renderHookWithProviders(() => useBenchmarkSeed("cindy"))

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(eqCalls).toEqual([{ column: "slug", value: "cindy" }])
    expect(isCalls).toEqual([{ column: "owner_id", value: null }])
    expect(selectCalls[0]).toContain("story_en")
    expect(selectCalls[0]).toContain("reference")
    expect(result.current.data).toEqual({
      id: CINDY_ID,
      slug: "cindy",
      label: "Cindy",
      aliases: [],
      rx: {
        mode: "amrap",
        cap_seconds: 1200,
        exercises: [{ exercise_id: PULL_ID, amount: 5, weight: 0 }],
      },
      tagline_fr: "Le WOD de Tom Holland.",
      tagline_en: "Tom Holland’s WOD.",
      story_fr: "Cinq tractions.",
      story_en: "Five pull-ups.",
      reference: { name: "Tom Holland", score: "27" },
    })
  })

  it("returns null when the slug is unknown or not a GymLogic seed", async () => {
    catalogRow = null

    const { result } = renderHookWithProviders(() => useBenchmarkSeed("not-a-seed"))

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(eqCalls).toEqual([{ column: "slug", value: "not-a-seed" }])
    expect(isCalls).toEqual([{ column: "owner_id", value: null }])
    expect(result.current.data).toBeNull()
  })

  it("does not fetch when the slug is empty", () => {
    const { result } = renderHookWithProviders(() => useBenchmarkSeed("  "))

    expect(result.current.isFetching).toBe(false)
    expect(eqCalls).toEqual([])
    expect(isCalls).toEqual([])
  })
})
