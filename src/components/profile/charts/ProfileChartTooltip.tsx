import type { CSSProperties, ReactNode } from "react"
import {
  useActiveTooltipCoordinate,
  usePlotArea,
  type TooltipProps,
} from "recharts"
import { ChartTooltip, useChart } from "@/components/ui/chart"

function tooltipFields(item: unknown) {
  if (item == null || typeof item !== "object") return undefined
  const row = Object.fromEntries(Object.entries(item))
  const dataKey = row.dataKey ?? row.name
  return {
    dataKey: dataKey == null ? "" : String(dataKey),
    name: row.name,
    value: row.value,
    color: typeof row.color === "string" ? row.color : undefined,
  }
}

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

/** Shared Tooltip: half-plot flip + in-plot clamp. Use on every profile chart. */
export function ProfileChartTooltipLayer({
  content,
  allowEscapeViewBox,
  reverseDirection,
}: {
  content: TooltipProps["content"]
  allowEscapeViewBox?: TooltipProps["allowEscapeViewBox"]
  reverseDirection?: { x: boolean; y: boolean }
}) {
  const coordinate = useActiveTooltipCoordinate()
  const plot = usePlotArea()
  return (
    <ChartTooltip
      {...PROFILE_CHART_TOOLTIP_PROPS}
      allowEscapeViewBox={
        allowEscapeViewBox ?? PROFILE_CHART_TOOLTIP_PROPS.allowEscapeViewBox
      }
      reverseDirection={
        reverseDirection ?? profileTooltipReverseDirection(coordinate, plot)
      }
      content={content}
    />
  )
}

export function ProfileChartTooltip({
  active,
  payload,
  label,
  formatValue,
  hideZeros = false,
}: {
  active?: boolean
  payload?: ReadonlyArray<unknown>
  label?: ReactNode
  formatValue?: (value: number, dataKey: string) => string
  hideZeros?: boolean
}) {
  const { config } = useChart()
  if (!active || payload == null || payload.length === 0) return null

  const rows = payload.flatMap((item, index) => {
    const fields = tooltipFields(item)
    if (fields == null || typeof fields.value !== "number") return []
    if (hideZeros && fields.value === 0) return []
    const name =
      (fields.dataKey !== "" ? config[fields.dataKey]?.label : undefined) ??
      (fields.name == null ? fields.dataKey : String(fields.name))
    const value = formatValue
      ? formatValue(fields.value, fields.dataKey)
      : fields.value.toLocaleString()
    return [
      {
        key: fields.dataKey || String(index),
        name,
        value,
        color: fields.color,
      },
    ]
  })

  if (rows.length === 0 && (label == null || label === "")) return null

  return (
    <div className="grid max-w-40 gap-1 rounded-md border border-border/50 bg-background px-2 py-1 text-[11px] shadow-md">
      {label != null && label !== "" ? (
        <p className="font-medium">{label}</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="grid gap-0.5">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="size-1.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: row.color }}
                />
                {row.name}
              </span>
              <span className="font-mono tabular-nums">{row.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
