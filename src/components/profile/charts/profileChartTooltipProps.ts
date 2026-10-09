import type { CSSProperties } from "react"

const CLEAR_BOX: CSSProperties = {
  background: "transparent",
  border: "none",
  boxShadow: "none",
  outline: "none",
  padding: 0,
}

export type TooltipFlipPoint = {
  readonly x: number
  readonly y: number
}

export type TooltipFlipBox = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Prefer the opposite side of the cursor when the active point is in the far
 * half of the plot. Recharts then places the box at `coordinate − size − offset`.
 */
export function profileTooltipReverseDirection(
  coordinate: TooltipFlipPoint | undefined,
  plot: TooltipFlipBox | undefined,
): { x: boolean; y: boolean } {
  if (
    coordinate == null ||
    plot == null ||
    plot.width <= 0 ||
    plot.height <= 0
  ) {
    return { x: false, y: false }
  }
  return {
    x: coordinate.x >= plot.x + plot.width / 2,
    y: coordinate.y >= plot.y + plot.height / 2,
  }
}

/**
 * Stay inside the plot so Recharts can flip when the preferred side still
 * overflows. `allowEscapeViewBox: true` is what clipped the last Mix bar.
 */
export const PROFILE_CHART_TOOLTIP_PROPS = {
  cursor: false,
  allowEscapeViewBox: { x: false, y: false },
  offset: 8,
  contentStyle: CLEAR_BOX,
  wrapperStyle: { ...CLEAR_BOX, pointerEvents: "none" },
} as const
