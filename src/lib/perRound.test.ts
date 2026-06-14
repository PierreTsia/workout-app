import { describe, it, expect } from "vitest"
import { resizePerRound } from "@/lib/perRound"
import type { PerRoundCell } from "@/types/database"

const cells = (...amounts: number[]): PerRoundCell[] =>
  amounts.map((amount) => ({ amount, weight: amount }))

describe("resizePerRound", () => {
  it("extends with a copy of the last cell when growing", () => {
    expect(resizePerRound(cells(20, 15), 4)).toEqual([
      { amount: 20, weight: 20 },
      { amount: 15, weight: 15 },
      { amount: 15, weight: 15 },
      { amount: 15, weight: 15 },
    ])
  })

  it("truncates from the end when shrinking, keeping leading rounds", () => {
    expect(resizePerRound(cells(20, 15, 10), 2)).toEqual([
      { amount: 20, weight: 20 },
      { amount: 15, weight: 15 },
    ])
  })

  it("returns the same length unchanged", () => {
    expect(resizePerRound(cells(20, 15, 10), 3)).toEqual(cells(20, 15, 10))
  })

  it("seeds zeros when growing from an empty prescription", () => {
    expect(resizePerRound([], 2)).toEqual([
      { amount: 0, weight: 0 },
      { amount: 0, weight: 0 },
    ])
  })
})
