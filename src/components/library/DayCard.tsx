import { useTranslation } from "react-i18next"
import { Layers } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

/** Solo line in a library day summary. */
export interface DayExercise {
  id: string
  emoji: string
  name: string
  sets: number
  reps: string
  restSeconds: number
  sortOrder: number
}

/** Circuit line in a library day summary (#454). */
export interface DayCircuitSummary {
  id: string
  label: string | null
  rounds: number
  exerciseCount: number
  sortOrder: number
}

export type DayCardItem =
  | ({ kind: "solo" } & DayExercise)
  | ({ kind: "circuit" } & DayCircuitSummary)

interface DayCardProps {
  label: string
  /** Total Unified Day Sequence slots (solo + Circuit). */
  exerciseCount: number
  muscleFocus?: string | null
  items: DayCardItem[]
}

export function DayCard({ label, exerciseCount, muscleFocus, items }: DayCardProps) {
  const { t } = useTranslation("library")
  const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{label}</CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {t("exerciseCount", { count: exerciseCount })}
          </Badge>
        </div>
        {muscleFocus && (
          <Badge variant="secondary" className="w-fit text-[10px]">
            {muscleFocus}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 pt-0">
        {ordered.map((item) =>
          item.kind === "circuit" ? (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 text-sm"
              data-testid="day-card-circuit"
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <Layers className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <span className="truncate">
                  {item.label?.trim() || t("circuit.fallbackLabel")}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("circuit.summary", {
                  count: item.exerciseCount,
                  rounds: item.rounds,
                })}
              </span>
            </div>
          ) : (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="truncate">
                {item.emoji} {item.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("setsReps", { sets: item.sets, reps: item.reps })}
                {" · "}
                {t("restSeconds", { seconds: item.restSeconds })}
              </span>
            </div>
          ),
        )}
      </CardContent>
    </Card>
  )
}
