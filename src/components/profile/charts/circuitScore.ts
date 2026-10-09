import { formatSecondsMMSS } from "@/lib/formatters"

export function formatCircuitSparkScore(
  score: number,
  mode: "amrap" | "rounds",
  roundsLabel: (count: number) => string,
): string {
  if (mode === "rounds") return formatSecondsMMSS(score)
  return roundsLabel(score)
}
