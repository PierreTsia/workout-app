import { useTranslation } from "react-i18next"
import { Info } from "lucide-react"
import { formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ExerciseHistoryTrendChartProps {
  /** Best est. 1RM per session in **display** units (oldest → newest). */
  valuesDisplay: number[]
  /** One label per point (e.g. relative dates), oldest → newest. */
  xLabels: string[]
  /** Weight unit suffix: `kg` or `lbs`. */
  unit: string
  className?: string
}

function yDomain(values: number[]): { yMin: number; yMax: number } {
  const minData = Math.min(...values)
  const maxData = Math.max(...values)
  if (maxData === minData) {
    const bump = Math.max(1, minData * 0.08 || 1)
    return {
      yMin: Math.max(0, minData - bump),
      yMax: maxData + bump,
    }
  }
  const pad = (maxData - minData) * 0.1
  return {
    yMin: Math.max(0, minData - pad),
    yMax: maxData + pad,
  }
}

function fmtWeight(v: number, locale: string, unit: string): string {
  const decimals = unit === "lbs" ? 1 : Number.isInteger(v) ? 0 : 1
  const n = formatNumber(v, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
  return `${n} ${unit}`
}

/**
 * Small line chart with Y scale (max / mid / min), light grid, and X labels per session.
 * Flat series uses a padded Y domain so the line is not edge-stuck and values stay readable.
 */
export function ExerciseHistoryTrendChart({
  valuesDisplay,
  xLabels,
  unit,
  className,
}: ExerciseHistoryTrendChartProps) {
  const { t, i18n } = useTranslation("workout")
  const locale = i18n.language

  if (valuesDisplay.length < 2 || xLabels.length !== valuesDisplay.length) {
    return null
  }

  const { yMin, yMax } = yDomain(valuesDisplay)
  const yMid = (yMin + yMax) / 2
  const span = yMax - yMin || 1

  const vbW = 220
  const vbH = 72
  const innerX = 4
  const innerY = 6
  const innerW = vbW - innerX * 2
  const innerH = vbH - innerY * 2

  const toSvgY = (v: number) =>
    innerY + (1 - (v - yMin) / span) * innerH

  const n = valuesDisplay.length
  const points = valuesDisplay
    .map((v, i) => {
      const x = innerX + (i / (n - 1)) * innerW
      const y = toSvgY(v)
      return `${x},${y}`
    })
    .join(" ")

  const gridYs = [yMax, yMid, yMin]
  const showMidLabel =
    span > 0 &&
    Math.abs(yMid - yMax) > span * 0.02 &&
    Math.abs(yMid - yMin) > span * 0.02

  return (
    <Card
      className={cn("w-full border-border/80 shadow-none", className)}
      role="region"
      aria-label={t("historySheet.chartAria", {
        max: fmtWeight(Math.max(...valuesDisplay), locale, unit),
        min: fmtWeight(Math.min(...valuesDisplay), locale, unit),
      })}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-center gap-1.5 space-y-0 p-3 pb-2">
        <CardTitle className="text-center text-xs font-normal leading-snug text-muted-foreground">
          {t("historySheet.chartCaption", { unit })}
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("historySheet.epleyInfoLabel")}
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            side="top"
            className="max-w-[min(100vw-2rem,20rem)] space-y-2 text-sm"
          >
            <p className="font-medium leading-tight text-foreground">
              {t("historySheet.epleyInfoTitle")}
            </p>
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
              {t("historySheet.epleyInfoBody")}
            </p>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
      <div className="flex gap-2">
        <div
          className="grid h-[4.5rem] w-[2.85rem] shrink-0 grid-rows-3 text-right text-[10px] leading-tight text-muted-foreground"
          aria-hidden
        >
          <span className="self-start tabular-nums">{fmtWeight(yMax, locale, unit)}</span>
          {showMidLabel ? (
            <span className="self-center tabular-nums">{fmtWeight(yMid, locale, unit)}</span>
          ) : (
            <span className="self-center" />
          )}
          <span className="self-end tabular-nums">{fmtWeight(yMin, locale, unit)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${vbW} ${vbH}`}
            className="h-[4.5rem] w-full text-primary"
            preserveAspectRatio="none"
          >
            {gridYs.map((gv, gi) => {
              const y = toSvgY(gv)
              return (
                <line
                  key={gi}
                  x1={innerX}
                  x2={innerX + innerW}
                  y1={y}
                  y2={y}
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
          <div className="mt-1 flex justify-between gap-1">
            {xLabels.map((label, i) => (
              <span
                key={i}
                className="min-w-0 flex-1 text-center text-[10px] leading-tight text-muted-foreground"
              >
                <span className="line-clamp-2 break-words">{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      </CardContent>
    </Card>
  )
}
