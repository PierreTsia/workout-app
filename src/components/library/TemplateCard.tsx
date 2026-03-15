import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { EnrichedTemplate } from "@/hooks/useTemplatesWithEquipment"

interface TemplateCardProps {
  template: EnrichedTemplate
  isSaved: boolean
  onSave: () => void
  onStart: () => void
  onDetails: () => void
  isSaving: boolean
}

export function TemplateCard({
  template,
  isSaved,
  onSave,
  onStart,
  onDetails,
  isSaving,
}: TemplateCardProps) {
  const { t } = useTranslation("library")

  const goalLabels: Record<string, string> = {
    strength: t("filterGoalStrength"),
    hypertrophy: t("filterGoalHypertrophy"),
    endurance: t("filterGoalEndurance"),
    general_fitness: t("filterGoalGeneralFitness"),
  }

  const equipmentLabels: Record<string, string> = {
    gym: t("filterEquipmentGym"),
    home: t("filterEquipmentHome"),
    minimal: t("filterEquipmentMinimal"),
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{template.name}</CardTitle>
          <button
            type="button"
            onClick={onDetails}
            className="shrink-0 text-xs text-primary underline-offset-2 hover:underline"
          >
            {t("details")}
          </button>
        </div>
        {template.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5 pt-0">
        <Badge variant="outline">{t("daysRange", { min: template.min_days, max: template.max_days })}</Badge>
        <Badge variant="secondary">{goalLabels[template.primary_goal] ?? template.primary_goal}</Badge>
        {template.experience_tags.map((exp) => (
          <Badge key={exp} variant="outline" className="text-[10px]">
            {exp}
          </Badge>
        ))}
        {template.equipmentContexts.map((eq) => (
          <Badge key={eq} variant="outline" className="text-[10px]">
            {equipmentLabels[eq] ?? eq}
          </Badge>
        ))}
      </CardContent>
      <CardFooter className="gap-2">
        {isSaved ? (
          <Button variant="outline" size="sm" disabled className="opacity-60">
            {t("saved")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving}>
            {t("save")}
          </Button>
        )}
        <Button size="sm" onClick={onStart}>
          {t("start")}
        </Button>
      </CardFooter>
    </Card>
  )
}
