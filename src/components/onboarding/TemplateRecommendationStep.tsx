import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useTemplates } from "@/hooks/useTemplates"
import { rankTemplates } from "@/lib/recommendTemplates"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ProgramTemplate, UserProfile } from "@/types/onboarding"

interface TemplateRecommendationStepProps {
  profile: UserProfile
  onSelect: (template: ProgramTemplate) => void
  onSkip: () => void
}

export function TemplateRecommendationStep({
  profile,
  onSelect,
  onSkip,
}: TemplateRecommendationStepProps) {
  const { t } = useTranslation("onboarding")
  const { data: templates, isLoading } = useTemplates()

  if (isLoading || !templates) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const ranked = rankTemplates(templates, profile)

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-8 pt-4">
      <h1 className="text-2xl font-bold">{t("recommendationTitle")}</h1>

      <div className="grid gap-4">
        {ranked.map((tpl, i) => (
          <Card
            key={tpl.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(tpl)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onSelect(tpl)
              }
            }}
            className={cn(
              "cursor-pointer transition-all hover:border-primary hover:shadow-md active:scale-[0.98]",
              i === 0 && "border-primary/50 shadow-sm",
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{tpl.name}</CardTitle>
                {i === 0 && (
                  <Badge variant="default" className="text-xs">
                    {t("recommendedBadge")}
                  </Badge>
                )}
              </div>
              {tpl.description && (
                <CardDescription className="text-sm">{tpl.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              <Badge variant="outline">
                {t("daysRange", { min: tpl.min_days, max: tpl.max_days })}
              </Badge>
              <Badge variant="secondary">
                {t(`goalBadge_${tpl.primary_goal}`)}
              </Badge>
            </CardContent>
          </Card>
        ))}

        {ranked.length === 0 && (
          <p className="text-center text-muted-foreground">
            {t("skipTemplate")}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="mt-auto text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        {t("skipTemplate")}
      </button>
    </div>
  )
}
