import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export interface DayExercise {
  id: string
  emoji: string
  name: string
  sets: number
  reps: string
  restSeconds: number
  sortOrder: number
}

interface DayCardProps {
  label: string
  exerciseCount: number
  muscleFocus?: string | null
  exercises: DayExercise[]
}

export function DayCard({ label, exerciseCount, muscleFocus, exercises }: DayCardProps) {
  const { t } = useTranslation("library")

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
      <CardContent className="space-y-1.5 pt-0">
        {[...exercises]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((ex) => (
            <div key={ex.id} className="flex items-center justify-between text-sm">
              <span className="truncate">
                {ex.emoji} {ex.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("setsReps", { sets: ex.sets, reps: ex.reps })}
                {" · "}
                {t("restSeconds", { seconds: ex.restSeconds })}
              </span>
            </div>
          ))}
      </CardContent>
    </Card>
  )
}
