import { describe, expect, it } from "vitest"
import { compactNumberSequence } from "./blockPrescription"

describe("compactNumberSequence", () => {
  it("returns an empty string for no rounds", () => {
    expect(compactNumberSequence([])).toBe("")
  })

  it("collapses uniform rounds to a single value", () => {
    expect(compactNumberSequence([10, 10, 10])).toBe("10")
  })

  it("joins pyramidal rounds with a separator", () => {
    expect(compactNumberSequence([10, 12, 8])).toBe("10·12·8")
  })

  it("keeps a single round as-is", () => {
    expect(compactNumberSequence([15])).toBe("15")
  })
})
