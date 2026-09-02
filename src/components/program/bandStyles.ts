import type { ScoreBand } from "@/lib/programScore/types"

export const BAND_CLASS: Record<Exclude<ScoreBand, "empty">, string> = {
  short: "text-muted-foreground",
  ok: "border-primary/30 bg-primary/10 text-primary",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
}
