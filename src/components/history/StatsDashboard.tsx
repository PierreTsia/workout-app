import { Dumbbell, Flame, Trophy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useStatsAggregates } from "@/hooks/useStatsAggregates"

function StatItem({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value: number
  loading: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-2xl font-bold tabular-nums">
        {loading ? "–" : value.toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function StatsDashboard() {
  const { data, isLoading } = useStatsAggregates()

  return (
    <Card>
      <CardContent className="grid grid-cols-3 gap-4 py-5">
        <StatItem
          icon={<Flame className="h-5 w-5" />}
          label="Sessions"
          value={data?.totalSessions ?? 0}
          loading={isLoading}
        />
        <StatItem
          icon={<Dumbbell className="h-5 w-5" />}
          label="Sets"
          value={data?.totalSets ?? 0}
          loading={isLoading}
        />
        <StatItem
          icon={<Trophy className="h-5 w-5" />}
          label="PRs"
          value={data?.totalPRs ?? 0}
          loading={isLoading}
        />
      </CardContent>
    </Card>
  )
}
