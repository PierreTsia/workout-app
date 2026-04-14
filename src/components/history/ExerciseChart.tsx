import { useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { Trophy } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
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
import { formatDate, formatSecondsMMSS } from "@/lib/formatters"

export function ExerciseChart({ exerciseId }: { exerciseId: string }) {
  const { t, i18n } = useTranslation("history")
  const { formatWeight, toDisplay, unit } = useWeightUnit()
  const { data: exercise, isLoading: exerciseLoading } = useExerciseById(exerciseId)
  const { data: logs, isLoading: logsLoading } = useExerciseTrend(exerciseId)
  const isDuration = exercise?.measurement_type === "duration"
  const isBodyweight = exercise?.equipment === "bodyweight" && !isDuration
  const loading = logsLoading || exerciseLoading

  const chartConfigReps = useMemo<ChartConfig>(
    () => ({
      reps: {
        label: t("maxReps"),
        color: "hsl(var(--primary))",
      },
    }),
    [t],
  )

  const chartConfigE1rm = useMemo<ChartConfig>(
    () => ({
      e1rm: {
        label: `${t("oneRm")} (${unit})`,
        color: "hsl(var(--primary))",
      },
    }),
    [t, unit],
  )

  const chartConfigDuration = useMemo<ChartConfig>(
    () => ({
      durationSec: {
        label: t("holdDuration"),
        color: "hsl(var(--primary))",
      },
    }),
    [t],
  )

  const chartDataReps = useMemo(() => {
    if (!logs) return []
    return logs.map((log) => {
      const r = parseInt(log.reps_logged ?? "0", 10)
      return {
        date: formatDate(log.logged_at, i18n.language, {
          month: "short",
          day: "numeric",
        }),
        reps: Number.isFinite(r) ? r : 0,
      }
    })
  }, [logs, i18n.language])

  const chartDataE1rm = useMemo(() => {
    if (!logs) return []
    return logs.map((log) => {
      const w = Number(log.weight_logged)
      const r = parseInt(log.reps_logged ?? "0", 10)
      const e1rm =
        log.estimated_1rm != null
          ? Number(log.estimated_1rm)
          : computeEpley1RM(w, r)
      return {
        date: formatDate(log.logged_at, i18n.language, {
          month: "short",
          day: "numeric",
        }),
        e1rm: Math.round(toDisplay(e1rm) * 10) / 10,
      }
    })
  }, [logs, i18n.language, toDisplay])

  const chartDataDuration = useMemo(() => {
    if (!logs) return []
    return logs
      .filter((log) => log.duration_seconds != null)
      .map((log) => ({
        date: formatDate(log.logged_at, i18n.language, {
          month: "short",
          day: "numeric",
        }),
        durationSec: Number(log.duration_seconds),
      }))
  }, [logs, i18n.language])

  const tableRowsBodyweight = useMemo(() => {
    if (!logs) return []
    return logs.map((log) => ({
      id: log.id,
      date: formatDate(log.logged_at, i18n.language, {
        month: "short",
        day: "numeric",
      }),
      reps: log.reps_logged,
      wasPr: log.was_pr,
    }))
  }, [logs, i18n.language])

  const tableRowsReps = useMemo(() => {
    if (!logs) return []
    return logs.map((log) => {
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
  }, [logs, i18n.language])

  const tableRowsDuration = useMemo(() => {
    if (!logs) return []
    return logs.map((log) => ({
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
        <ChartContainer config={chartConfigDuration} className="aspect-[2/1] w-full">
          <LineChart
            data={chartDataDuration}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={40}
              tickFormatter={(v) => (Number(v) >= 60 ? formatSecondsMMSS(Number(v)) : `${v}s`)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="durationSec"
              type="monotone"
              stroke="var(--color-durationSec)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
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
            {tableRowsDuration.map((row) => (
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
      </div>
    )
  }

  if (isBodyweight) {
    return (
      <div className="flex flex-col gap-4">
        <ChartContainer config={chartConfigReps} className="aspect-[2/1] w-full">
          <LineChart data={chartDataReps} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={40}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="reps"
              type="monotone"
              stroke="var(--color-reps)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
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
            {tableRowsBodyweight.map((row) => (
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
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={chartConfigE1rm} className="aspect-[2/1] w-full">
        <LineChart data={chartDataE1rm} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={40}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="e1rm"
            type="monotone"
            stroke="var(--color-e1rm)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
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
          {tableRowsReps.map((row) => (
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
    </div>
  )
}
