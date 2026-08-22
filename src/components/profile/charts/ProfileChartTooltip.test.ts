import { describe, expect, it } from "vitest"
import {
  PROFILE_CHART_TOOLTIP_PROPS,
  profileTooltipReverseDirection,
} from "./ProfileChartTooltip"

const PLOT = { x: 0, y: 0, width: 200, height: 100 }

describe("profileTooltipReverseDirection", () => {
  it("keeps the tooltip to the right / below on the near side", () => {
    expect(
      profileTooltipReverseDirection({ x: 40, y: 20 }, PLOT),
    ).toEqual({ x: false, y: false })
  })

  it("flips left when the cursor is in the right half of the plot", () => {
    expect(
      profileTooltipReverseDirection({ x: 160, y: 20 }, PLOT),
    ).toEqual({ x: true, y: false })
  })

  it("flips above when the cursor is in the bottom half of the plot", () => {
    expect(
      profileTooltipReverseDirection({ x: 40, y: 80 }, PLOT),
    ).toEqual({ x: false, y: true })
  })

  it("flips both axes in the far corner", () => {
    expect(
      profileTooltipReverseDirection({ x: 199, y: 99 }, PLOT),
    ).toEqual({ x: true, y: true })
  })

  it("does not flip without a measured plot", () => {
    expect(profileTooltipReverseDirection({ x: 160, y: 80 }, undefined)).toEqual(
      { x: false, y: false },
    )
  })
})

describe("PROFILE_CHART_TOOLTIP_PROPS", () => {
  it("keeps the tooltip inside the plot so Recharts can clamp a flip", () => {
    expect(PROFILE_CHART_TOOLTIP_PROPS.allowEscapeViewBox).toEqual({
      x: false,
      y: false,
    })
  })
})
