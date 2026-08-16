import { useTranslation } from "react-i18next"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { BenchmarkCopy } from "@/hooks/useBenchmarkCompletionHistory"
import { isEnglish } from "@/lib/catalogLabels"

export function BenchmarkStoryHeader({ copy }: { copy: BenchmarkCopy }) {
  const { t, i18n } = useTranslation("history")
  const english = isEnglish(i18n.language)
  const tagline = english
    ? (copy.tagline_en ?? copy.tagline_fr)
    : (copy.tagline_fr ?? copy.tagline_en)
  const story = english
    ? (copy.story_en ?? copy.story_fr)
    : (copy.story_fr ?? copy.story_en)

  return (
    <Card className="border-border/60 bg-muted/20 shadow-none">
      <CardHeader className="gap-1.5 p-3">
        {tagline ? (
          <CardTitle className="text-sm font-semibold leading-snug">
            {tagline}
          </CardTitle>
        ) : null}
        {story ? (
          <CardDescription className="text-xs leading-relaxed">
            {story}
          </CardDescription>
        ) : null}
        {copy.reference ? (
          <CardDescription className="text-[11px] italic">
            {t("circuit.referenceBeat", {
              name: copy.reference.name,
              score: copy.reference.score,
            })}
          </CardDescription>
        ) : null}
      </CardHeader>
    </Card>
  )
}
