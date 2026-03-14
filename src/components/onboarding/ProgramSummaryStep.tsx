import { useTranslation } from "react-i18next"
import { adaptForExperience } from "@/lib/generateProgram"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { ProgramTemplate, UserProfile } from "@/types/onboarding"

interface ProgramSummaryStepProps {
  template: ProgramTemplate
  profile: UserProfile
  onConfirm: () => void
  onBack: () => void
}

export function ProgramSummaryStep({
  template,
  profile,
  onConfirm,
  onBack,
}: ProgramSummaryStepProps) {
  const { t } = useTranslation("onboarding")

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-8 pt-4">
      <div>
        <h1 className="text-2xl font-bold">{t("summaryTitle")}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{template.name}</p>
      </div>

      <div className="grid gap-4">
        {[...template.template_days]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((day) => (
            <Card key={day.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{day.day_label}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {t("summaryExercises", { count: day.template_exercises.length })}
                  </Badge>
                </div>
                {day.muscle_focus && (
                  <p className="text-xs text-muted-foreground">{day.muscle_focus}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {[...day.template_exercises]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((te) => {
                    const adapted = adaptForExperience(
                      te.rep_range,
                      te.sets,
                      te.rest_seconds,
                      profile.experience,
                    )
                    return (
                      <div
                        key={te.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">
                          {te.exercise?.emoji ?? "🏋️"}{" "}
                          {te.exercise?.name ?? "Exercise"}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t("summarySets", { sets: adapted.sets, reps: adapted.reps })}
                          {" · "}
                          {t("summaryRest", { seconds: adapted.restSeconds })}
                        </span>
                      </div>
                    )
                  })}
              </CardContent>
            </Card>
          ))}
      </div>

      <div className="mt-auto flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
          {t("back")}
        </Button>
        <Button size="lg" onClick={onConfirm} className="flex-1">
          {t("createProgram")}
        </Button>
      </div>
    </div>
  )
}
