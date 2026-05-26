import { useMemo, useState } from "react"
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Trophy } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useExerciseById } from "@/hooks/useExerciseById"
import { useExerciseTrend } from "@/hooks/useExerciseTrend"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { computeEpley1RM } from "@/lib/epley"
import { buildExerciseTrendSeries } from "@/lib/exerciseTrend"
import { formatDate, formatSecondsMMSS } from "@/lib/formatters"

const TABLE_PAGE_SIZE = 100

function LoadMoreButton({
  visible,
  total,
  onClick,
  label,
}: {
  visible: number
  total: number
  onClick: () => void
  label: string
}) {
  if (visible >= total) return null
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="self-center"
    >
      {label}
    </Button>
  )
}

type TooltipPayloadItem = {
  dataKey?: string | number
  payload?: { timestamp?: number }
}

/**
 * Wraps `ChartTooltipContent` to (a) format the X-axis timestamp as a date in
 * the header and (b) hide the raw `timestamp` row that recharts auto-includes
 * for Scatter series on a numeric X-axis.
 */
function TrendChartTooltip({
  language,
  active,
  payload,
}: {
  language: string
  active?: boolean
  payload?: TooltipPayloadItem[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const filtered = payload.filter((p) => p.dataKey !== "timestamp")
  const timestamp = payload[0]?.payload?.timestamp
  return (
    <ChartTooltipContent
      active={active}
      payload={filtered as never}
      labelFormatter={() =>
        timestamp != null
          ? formatDate(new Date(timestamp), language, {
              month: "short",
              day: "numeric",
            })
          : ""
      }
    />
  )
}

export function ExerciseChart({ exerciseId }: { exerciseId: string }) {
  const { t, i18n } = useTranslation("history")
  const { formatWeight, toDisplay, unit } = useWeightUnit()
  const { data: exercise, isLoading: exerciseLoading } = useExerciseById(exerciseId)
  const { data: logs, isLoading: logsLoading } = useExerciseTrend(exerciseId)
  const [visibleCount, setVisibleCount] = useState(TABLE_PAGE_SIZE)
  const isDuration = exercise?.measurement_type === "duration"
  const isBodyweight = exercise?.equipment === "bodyweight" && !isDuration
  const loading = logsLoading || exerciseLoading

  const chartConfigReps = useMemo<ChartConfig>(
    () => ({
      value: { label: t("maxReps"), color: "hsl(var(--primary))" },
      trend: { label: t("trend"), color: "hsl(var(--primary))" },
    }),
    [t],
  )

  const chartConfigE1rm = useMemo<ChartConfig>(
    () => ({
      value: {
        label: `${t("oneRm")} (${unit})`,
        color: "hsl(var(--primary))",
      },
      trend: { label: t("trend"), color: "hsl(var(--primary))" },
    }),
    [t, unit],
  )

  const chartConfigDuration = useMemo<ChartConfig>(
    () => ({
      value: { label: t("holdDuration"), color: "hsl(var(--primary))" },
      trend: { label: t("trend"), color: "hsl(var(--primary))" },
    }),
    [t],
  )

  const chartDataReps = useMemo(() => {
    if (!logs) return []
    const series = buildExerciseTrendSeries(logs, "reps")
    return series.scatter.map((p, i) => ({
      timestamp: p.timestamp,
      value: p.value,
      trend: Math.round(series.trend[i].value * 10) / 10,
    }))
  }, [logs])

  const chartDataE1rm = useMemo(() => {
    if (!logs) return []
    const series = buildExerciseTrendSeries(logs, "e1rm")
    return series.scatter.map((p, i) => ({
      timestamp: p.timestamp,
      value: Math.round(toDisplay(p.value) * 10) / 10,
      trend: Math.round(toDisplay(series.trend[i].value) * 10) / 10,
    }))
  }, [logs, toDisplay])

  const chartDataDuration = useMemo(() => {
    if (!logs) return []
    const series = buildExerciseTrendSeries(logs, "duration")
    return series.scatter.map((p, i) => ({
      timestamp: p.timestamp,
      value: p.value,
      trend: Math.round(series.trend[i].value),
    }))
  }, [logs])

  const tableRowsBodyweight = useMemo(() => {
    if (!logs) return []
    return logs
      .map((log) => ({
        id: log.id,
        date: formatDate(log.logged_at, i18n.language, {
          month: "short",
          day: "numeric",
        }),
        reps: log.reps_logged,
        wasPr: log.was_pr,
      }))
      .reverse()
  }, [logs, i18n.language])

  const tableRowsReps = useMemo(() => {
    if (!logs) return []
    return logs
      .map((log) => {
        const w = Number(log.weight_logged)
        const r = parseInt(log.reps_logged ?? "0", 10)
        const e1rm =
          log.estimated_1rm != null
            ? Number(log.estimated_1rm)
            : computeEpley1RM(w, r)
        return {
          id: log.id,
          date: formatDate(log.logged_at, i18n.language, {
            month: "short",
            day: "numeric",
          }),
          reps: log.reps_logged,
          weightKg: w,
          e1rm: Math.round(e1rm),
          wasPr: log.was_pr,
        }
      })
      .reverse()
  }, [logs, i18n.language])

  const tableRowsDuration = useMemo(() => {
    if (!logs) return []
    return logs
      .map((log) => ({
        id: log.id,
        date: formatDate(log.logged_at, i18n.language, {
          month: "short",
          day: "numeric",
        }),
        durationLabel:
          log.duration_seconds != null
            ? formatSecondsMMSS(log.duration_seconds)
            : "–",
        weightKg: Number(log.weight_logged),
        wasPr: log.was_pr,
      }))
      .reverse()
  }, [logs, i18n.language])

  if (loading) {
    return <div className="h-52 animate-pulse rounded-lg bg-muted/40" />
  }

  if (!logs || logs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("noData")}
      </p>
    )
  }

  if (isDuration) {
    return (
      <div className="flex flex-col gap-4">
        <ChartContainer config={chartConfigDuration} className="aspect-2/1 w-full">
          <ComposedChart
            data={chartDataDuration}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickFormatter={(ts) =>
                formatDate(new Date(Number(ts)), i18n.language, {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={40}
              tickFormatter={(v) => (Number(v) >= 60 ? formatSecondsMMSS(Number(v)) : `${v}s`)}
            />
            <ChartTooltip content={<TrendChartTooltip language={i18n.language} />} />
            <Scatter
              dataKey="value"
              fill="var(--color-value)"
              fillOpacity={0.4}
              shape="circle"
            />
            <Line
              dataKey="trend"
              type="monotone"
              stroke="var(--color-trend)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>

        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 px-2">{t("date")}</TableHead>
              <TableHead className="h-8 px-2">{t("holdDuration")}</TableHead>
              <TableHead className="h-8 px-2">{t("weightUnit")}</TableHead>
              <TableHead className="h-8 w-12 px-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRowsDuration.slice(0, visibleCount).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="px-2 py-1.5">{row.date}</TableCell>
                <TableCell className="px-2 py-1.5 font-mono tabular-nums">
                  {row.durationLabel}
                </TableCell>
                <TableCell className="px-2 py-1.5 tabular-nums">
                  {formatWeight(row.weightKg)}
                </TableCell>
                <TableCell className="px-2 py-1.5">
                  {row.wasPr && (
                    <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[10px]">
                      <Trophy className="h-3 w-3" />
                      {t("pr")}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <LoadMoreButton
          visible={visibleCount}
          total={tableRowsDuration.length}
          onClick={() => setVisibleCount((n) => n + TABLE_PAGE_SIZE)}
          label={t("loadMore")}
        />
      </div>
    )
  }

  if (isBodyweight) {
    return (
      <div className="flex flex-col gap-4">
        <ChartContainer config={chartConfigReps} className="aspect-2/1 w-full">
          <ComposedChart data={chartDataReps} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickFormatter={(ts) =>
                formatDate(new Date(Number(ts)), i18n.language, {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={40}
              allowDecimals={false}
            />
            <ChartTooltip content={<TrendChartTooltip language={i18n.language} />} />
            <Scatter
              dataKey="value"
              fill="var(--color-value)"
              fillOpacity={0.4}
              shape="circle"
            />
            <Line
              dataKey="trend"
              type="monotone"
              stroke="var(--color-trend)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>

        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 px-2">{t("date")}</TableHead>
              <TableHead className="h-8 px-2">{t("workout:reps", { defaultValue: "Reps" })}</TableHead>
              <TableHead className="h-8 w-12 px-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRowsBodyweight.slice(0, visibleCount).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="px-2 py-1.5">{row.date}</TableCell>
                <TableCell className="px-2 py-1.5 tabular-nums">{row.reps}</TableCell>
                <TableCell className="px-2 py-1.5">
                  {row.wasPr && (
                    <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[10px]">
                      <Trophy className="h-3 w-3" />
                      {t("pr")}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <LoadMoreButton
          visible={visibleCount}
          total={tableRowsBodyweight.length}
          onClick={() => setVisibleCount((n) => n + TABLE_PAGE_SIZE)}
          label={t("loadMore")}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={chartConfigE1rm} className="aspect-2/1 w-full">
        <ComposedChart data={chartDataE1rm} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickFormatter={(ts) =>
              formatDate(new Date(Number(ts)), i18n.language, {
                month: "short",
                day: "numeric",
              })
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={40}
          />
          <ChartTooltip content={<TrendChartTooltip language={i18n.language} />} />
          <Scatter
            dataKey="value"
            fill="var(--color-value)"
            fillOpacity={0.4}
            shape="circle"
          />
          <Line
            dataKey="trend"
            type="monotone"
            stroke="var(--color-trend)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ChartContainer>

      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 px-2">{t("date")}</TableHead>
            <TableHead className="h-8 px-2">{t("workout:reps", { defaultValue: "Reps" })}</TableHead>
            <TableHead className="h-8 px-2">{t("weightUnit")}</TableHead>
            <TableHead className="h-8 px-2">{t("oneRm")}</TableHead>
            <TableHead className="h-8 w-12 px-2" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableRowsReps.slice(0, visibleCount).map((row) => (
            <TableRow key={row.id}>
              <TableCell className="px-2 py-1.5">{row.date}</TableCell>
              <TableCell className="px-2 py-1.5 tabular-nums">{row.reps}</TableCell>
              <TableCell className="px-2 py-1.5 tabular-nums">{formatWeight(row.weightKg)}</TableCell>
              <TableCell className="px-2 py-1.5 tabular-nums">
                {row.e1rm > 0 ? row.e1rm : "–"}
              </TableCell>
              <TableCell className="px-2 py-1.5">
                {row.wasPr && (
                  <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[10px]">
                    <Trophy className="h-3 w-3" />
                    {t("pr")}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <LoadMoreButton
        visible={visibleCount}
        total={tableRowsReps.length}
        onClick={() => setVisibleCount((n) => n + TABLE_PAGE_SIZE)}
        label={t("loadMore")}
      />
    </div>
  )
}
