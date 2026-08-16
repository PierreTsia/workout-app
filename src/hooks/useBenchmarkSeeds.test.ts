import { vi, describe, it, expect, beforeEach } from "vitest"
import { waitFor } from "@testing-library/react"
import { renderHookWithProviders } from "@/test/utils"
import { useBenchmarkSeeds } from "./useBenchmarkSeeds"

const CINDY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const PULL_ID = "11111111-1111-4111-8111-111111111111"

function makeCindyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CINDY_ID,
    slug: "cindy",
    label: "Cindy",
    aliases: ["holland", "tom holland"],
    rx: {
      mode: "amrap",
      cap_seconds: 1200,
      exercises: [{ exercise_id: PULL_ID, amount: 5, weight: 0 }],
    },
    tagline_fr: "Le WOD de Tom Holland.",
    tagline_en: "Tom Holland’s WOD.",
    ...overrides,
  }
}

const isCalls: { column: string; value: unknown }[] = []
const selectCalls: string[] = []
const orderCalls: { column: string; options: unknown }[] = []
let catalogRows: unknown[] = []

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => ({
        is: (column: string, value: unknown) => {
          if (table !== "benchmark_circuits") {
            throw new Error(`unexpected table ${table}`)
          }
          selectCalls.push(columns)
          isCalls.push({ column, value })
          return {
            order: (orderColumn: string, options: unknown) => {
              orderCalls.push({ column: orderColumn, options })
              return Promise.resolve({ data: catalogRows, error: null })
            },
          }
        },
      }),
    }),
  },
}))

describe("useBenchmarkSeeds", () => {
  beforeEach(() => {
    isCalls.length = 0
    selectCalls.length = 0
    orderCalls.length = 0
    catalogRows = []
  })

  it("filters GymLogic seeds with owner_id IS NULL", async () => {
    const { result } = renderHookWithProviders(() => useBenchmarkSeeds(true))

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(isCalls).toEqual([{ column: "owner_id", value: null }])
    expect(selectCalls[0]).toContain("label")
    expect(selectCalls[0]).toContain("story_fr")
    expect(orderCalls).toEqual([{ column: "slug", options: { ascending: true } }])
  })

  it("parses catalog rows and drops unparsable Rx", async () => {
    catalogRows = [
      makeCindyRow(),
      { id: "broken", slug: "broken", rx: { mode: "nope" } },
    ]

    const { result } = renderHookWithProviders(() => useBenchmarkSeeds(true))

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([
      {
        id: CINDY_ID,
        slug: "cindy",
        label: "Cindy",
        aliases: ["holland", "tom holland"],
        rx: {
          mode: "amrap",
          cap_seconds: 1200,
          exercises: [{ exercise_id: PULL_ID, amount: 5, weight: 0 }],
        },
        tagline_fr: "Le WOD de Tom Holland.",
        tagline_en: "Tom Holland’s WOD.",
        story_fr: null,
        story_en: null,
        reference: null,
      },
    ])
  })

  it("does not fetch when the picker is closed", () => {
    const { result } = renderHookWithProviders(() => useBenchmarkSeeds(false))

    expect(result.current.isFetching).toBe(false)
    expect(isCalls).toEqual([])
  })
})
