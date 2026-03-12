import { useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { Trophy } from "lucide-react"
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
import { useExerciseTrend } from "@/hooks/useExerciseTrend"
import { computeEpley1RM } from "@/lib/epley"

const chartConfig = {
  weight: {
    label: "Weight (kg)",
    color: "hsl(var(--primary))",
  },
  reps: {
    label: "Reps",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function ExerciseChart({ exerciseId }: { exerciseId: string }) {
  const { data: logs, isLoading } = useExerciseTrend(exerciseId)

  const chartData = useMemo(() => {
    if (!logs) return []
    return logs.map((log) => ({
      date: formatDate(log.logged_at),
      weight: Number(log.weight_logged),
      reps: parseInt(log.reps_logged, 10) || 0,
    }))
  }, [logs])

  const tableRows = useMemo(() => {
    if (!logs) return []
    return logs.map((log) => {
      const w = Number(log.weight_logged)
      const r = parseInt(log.reps_logged, 10)
      const e1rm =
        log.estimated_1rm != null
          ? Number(log.estimated_1rm)
          : computeEpley1RM(w, r)
      return {
        id: log.id,
        date: formatDate(log.logged_at),
        reps: log.reps_logged,
        weight: w,
        e1rm: Math.round(e1rm),
        wasPr: log.was_pr,
      }
    })
  }, [logs])

  if (isLoading) {
    return <div className="h-52 animate-pulse rounded-lg bg-muted/40" />
  }

  if (!logs || logs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No data for this exercise yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            yAxisId="weight"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={40}
          />
          <YAxis
            yAxisId="reps"
            orientation="right"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={30}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            yAxisId="weight"
            dataKey="weight"
            type="monotone"
            stroke="var(--color-weight)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="reps"
            dataKey="reps"
            type="monotone"
            stroke="var(--color-reps)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        </LineChart>
      </ChartContainer>

      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 px-2">Date</TableHead>
            <TableHead className="h-8 px-2">Reps</TableHead>
            <TableHead className="h-8 px-2">Weight</TableHead>
            <TableHead className="h-8 px-2">1RM</TableHead>
            <TableHead className="h-8 w-12 px-2" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="px-2 py-1.5">{row.date}</TableCell>
              <TableCell className="px-2 py-1.5 tabular-nums">{row.reps}</TableCell>
              <TableCell className="px-2 py-1.5 tabular-nums">{row.weight}kg</TableCell>
              <TableCell className="px-2 py-1.5 tabular-nums">
                {row.e1rm > 0 ? row.e1rm : "–"}
              </TableCell>
              <TableCell className="px-2 py-1.5">
                {row.wasPr && (
                  <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[10px]">
                    <Trophy className="h-3 w-3" />
                    PR
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
