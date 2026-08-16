import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { AmrapLabel } from "@/components/circuit/AmrapLabel"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { isEnglish } from "@/lib/catalogLabels"
import type { CatalogSeedRow } from "@/lib/previewCatalogCircuit"

function localizedCopy(
  english: boolean,
  fr: string | null,
  en: string | null,
): string | null {
  const primary = english ? en : fr
  const fallback = english ? fr : en
  const chosen = primary ?? fallback
  return chosen && chosen.trim() !== "" ? chosen : null
}

export function CircuitCatalogCard({
  seed,
  to,
}: {
  seed: CatalogSeedRow
  to: string
}) {
  const { i18n } = useTranslation()
  const english = isEnglish(i18n.language)
  const tagline = localizedCopy(english, seed.tagline_fr, seed.tagline_en)
  const story = localizedCopy(english, seed.story_fr, seed.story_en)
  const storyOnCard = story != null && story !== tagline
  const isAmrap = seed.rx.mode === "amrap"
  const capMinutes =
    seed.rx.cap_seconds != null ? Math.round(seed.rx.cap_seconds / 60) : 20

  return (
    <Link
      to={to}
      aria-label={seed.label}
      title={seed.label}
      className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="border-border/80 bg-card/80 transition-colors hover:border-primary/40 hover:bg-accent/30">
        <CardHeader className="gap-2 p-4">
          <CardTitle className="text-lg leading-tight">{seed.label}</CardTitle>
          {isAmrap ? <AmrapLabel minutes={capMinutes} /> : null}
          {tagline ? (
            <CardDescription className="text-sm font-medium leading-snug text-foreground/90">
              {tagline}
            </CardDescription>
          ) : null}
        </CardHeader>
        {storyOnCard ? (
          <CardContent className="px-4 pb-4 pt-0">
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {story}
            </p>
          </CardContent>
        ) : null}
      </Card>
    </Link>
  )
}