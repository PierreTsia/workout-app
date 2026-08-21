import { Line, LineChart } from "recharts"
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart"

const sparkConfig = {
  score: { label: "Score", color: "hsl(174 100% 39%)" },
} satisfies ChartConfig

export function CircuitScoreSparkline({
  name,
  values,
}: {
  name: string
  values: readonly number[]
}) {
  if (values.length < 2) return null

  const data = values.map((value, i) => ({ i, score: value }))

  return (
    <ChartContainer
      config={sparkConfig}
      className="h-10 w-24"
      role="img"
      aria-label={`${name} score`}
    >
      <LineChart data={data}>
        <Line
          dataKey="score"
          type="monotone"
          stroke="var(--color-score)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
