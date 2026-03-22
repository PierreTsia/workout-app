import { describe, expect, it } from "vitest"
import { heatmapLevelFromTrainingMinutes } from "./heatmapLevelFromTrainingMinutes"

describe("heatmapLevelFromTrainingMinutes", () => {
  it("returns 0 for no time", () => {
    expect(heatmapLevelFromTrainingMinutes(0)).toBe(0)
  })

  it("steps through bands", () => {
    expect(heatmapLevelFromTrainingMinutes(8)).toBe(1)
    expect(heatmapLevelFromTrainingMinutes(18)).toBe(2)
    expect(heatmapLevelFromTrainingMinutes(30)).toBe(3)
    expect(heatmapLevelFromTrainingMinutes(47)).toBe(4)
    expect(heatmapLevelFromTrainingMinutes(80)).toBe(5)
    expect(heatmapLevelFromTrainingMinutes(95)).toBe(6)
  })
})
