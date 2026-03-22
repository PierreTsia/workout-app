import { describe, expect, it } from "vitest"
import { heatmapLevelFromTrainingMinutes } from "./heatmapLevelFromTrainingMinutes"

describe("heatmapLevelFromTrainingMinutes", () => {
  it("returns 0 for no time", () => {
    expect(heatmapLevelFromTrainingMinutes(0)).toBe(0)
  })

  it("steps through bands", () => {
    expect(heatmapLevelFromTrainingMinutes(10)).toBe(1)
    expect(heatmapLevelFromTrainingMinutes(20)).toBe(2)
    expect(heatmapLevelFromTrainingMinutes(40)).toBe(3)
    expect(heatmapLevelFromTrainingMinutes(90)).toBe(4)
  })
})
