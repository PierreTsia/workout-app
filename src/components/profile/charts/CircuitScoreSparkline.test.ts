import { describe, expect, it } from "vitest"
import { formatCircuitSparkScore } from "./CircuitScoreSparkline"

const tours = (count: number) => (count === 1 ? `${count} tour` : `${count} tours`)

describe("formatCircuitSparkScore", () => {
  it("labels AMRAP points as rounds", () => {
    expect(formatCircuitSparkScore(4, "amrap", tours)).toBe("4 tours")
    expect(formatCircuitSparkScore(1, "amrap", tours)).toBe("1 tour")
  })

  it("labels For Time points as mm:ss, not rounds", () => {
    expect(formatCircuitSparkScore(750, "rounds", tours)).toBe("12:30")
    expect(formatCircuitSparkScore(478, "rounds", tours)).toBe("7:58")
  })
})
