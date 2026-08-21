import { Line, LineChart } from "recharts"
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart"

const sparkConfig = {
  rounds: { label: "Rounds", color: "hsl(174 100% 39%)" },
} satisfies ChartConfig

export function CircuitScoreSparkline({
  name,
  rounds,
}: {
  name: string
  rounds: readonly number[]
}) {
  if (rounds.length < 2) return null

  const data = rounds.map((value, i) => ({ i, rounds: value }))

  return (
    <ChartContainer
      config={sparkConfig}
      className="h-10 w-24"
      role="img"
      aria-label={`${name} score`}
    >
      <LineChart data={data}>
        <Line
          dataKey="rounds"
          type="monotone"
          stroke="var(--color-rounds)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
