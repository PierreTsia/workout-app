import { describe, expect, it } from "vitest"
import { replaceCatalogCircuits } from "./replaceCatalogCircuits"
import type { QwCircuitItem, QwDayItem } from "./validate"

function makeLlmCircuit(overrides: Partial<QwCircuitItem> = {}): QwCircuitItem {
  return {
    type: "circuit",
    label: "Finisher",
    rounds: 3,
    rest_seconds: 90,
    exercises: [
      { exercise_id: "ex-pull", amount: 6, weight_kg: 0 },
      { exercise_id: "ex-push", amount: 11, weight_kg: 0 },
      { exercise_id: "ex-squat", amount: 16, weight_kg: 0 },
    ],
    ...overrides,
  }
}

describe("replaceCatalogCircuits", () => {
  it("T192: closed-intent Cindy drops LLM exercises and emits benchmark_slug", () => {
    const items: QwDayItem[] = [
      makeLlmCircuit({
        label: "Cindy",
        mode: "amrap",
        cap_minutes: 20,
        rounds: undefined,
        rest_seconds: undefined,
      }),
    ]

    expect(replaceCatalogCircuits(items, "Cindy")).toEqual([
      { type: "circuit", benchmark_slug: "cindy" },
    ])
  })

  it("T192: closed-intent Holland (seed alias) replaces with cindy slug", () => {
    const items: QwDayItem[] = [makeLlmCircuit({ label: "AMRAP 20" })]
    expect(replaceCatalogCircuits(items, "Holland")).toEqual([
      { type: "circuit", benchmark_slug: "cindy" },
    ])
  })

  it("T192: item label Cindy replaces even when focusAreas is generic", () => {
    const items: QwDayItem[] = [makeLlmCircuit({ label: "Cindy" })]
    expect(replaceCatalogCircuits(items, "full body")).toEqual([
      { type: "circuit", benchmark_slug: "cindy" },
    ])
  })

  it("T192: 4 rounds Cindy still becomes official catalog cindy, not Tours", () => {
    const items: QwDayItem[] = [
      makeLlmCircuit({ label: "4 rounds Cindy", rounds: 4 }),
    ]
    expect(replaceCatalogCircuits(items, "4 rounds Cindy")).toEqual([
      { type: "circuit", benchmark_slug: "cindy" },
    ])
  })

  it("T192: HIIT 20 min with no seed name stays jetable", () => {
    const hiit = makeLlmCircuit({ label: "HIIT 20 min" })
    expect(replaceCatalogCircuits([hiit], "HIIT 20 min")).toEqual([hiit])
  })

  it("T192: generic AMRAP (no seed name) stays jetable with mode and cap", () => {
    const amrap = makeLlmCircuit({
      label: "AMRAP 20",
      mode: "amrap",
      cap_minutes: 15,
      rounds: undefined,
      rest_seconds: undefined,
    })
    expect(replaceCatalogCircuits([amrap], "AMRAP 20 min")).toEqual([amrap])
  })
})
