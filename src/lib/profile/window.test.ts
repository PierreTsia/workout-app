import { describe, expect, it } from "vitest"
import { includeDeltas, MIX_CATEGORIES } from "./window"

describe("profile window", () => {
  it("omits vs-prior deltas on all-time", () => {
    expect(includeDeltas("7")).toBe(true)
    expect(includeDeltas("all")).toBe(false)
  })

  it("caps 1y Mix grain at 12 months", () => {
    expect(MIX_CATEGORIES["365"]).toHaveLength(12)
  })
})
