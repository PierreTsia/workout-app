import { describe, expect, it } from "vitest"
import { CHART_SURFACE_CLASS } from "./chart"

describe("CHART_SURFACE_CLASS", () => {
  it("does not paint a focus ring on Recharts nodes (iOS tap focuses them)", () => {
    expect(CHART_SURFACE_CLASS).not.toContain(
      "recharts-wrapper:focus-visible]:ring-2",
    )
    expect(CHART_SURFACE_CLASS).not.toContain(
      "recharts-surface:focus-visible]:ring-2",
    )
    expect(CHART_SURFACE_CLASS).toContain("recharts-wrapper_*:focus-visible]:ring-0")
  })
})
