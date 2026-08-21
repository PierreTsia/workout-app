import type { ReactNode } from "react"
import { useChart } from "@/components/ui/chart"

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

export function ProfileChartTooltip({
  active,
  payload,
  label,
  lesson,
  formatValue,
  hideZeros = false,
}: {
  active?: boolean
  payload?: ReadonlyArray<unknown>
  label?: ReactNode
  lesson?: string
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

  return (
    <div className="grid max-w-64 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {label != null && label !== "" ? (
        <p className="font-medium">{label}</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="grid gap-1">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: row.color }}
                />
                {row.name}
              </span>
              <span className="font-mono tabular-nums">{row.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {lesson ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{lesson}</p>
      ) : null}
    </div>
  )
}
