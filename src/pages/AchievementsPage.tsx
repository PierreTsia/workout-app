import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { AchievementAccordion } from "@/components/achievements/AchievementAccordion"
import { BadgeDetailDrawer } from "@/components/achievements/BadgeDetailDrawer"
import type { BadgeStatusRow } from "@/types/achievements"

export function AchievementsPage() {
  const { t } = useTranslation("achievements")
  const navigate = useNavigate()
  const { data: rows = [], isLoading, isError } = useBadgeStatus()
  const [selected, setSelected] = useState<BadgeStatusRow | null>(null)

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-destructive">{t("loadError")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-10 pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{t("pageTitle")}</h1>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <>
          {rows.length > 0 && rows.every((r) => !r.is_unlocked) && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center">
              <div className="relative">
                <span className="text-5xl grayscale opacity-25">🏆</span>
                <span className="absolute -right-3 -top-1 text-lg animate-bounce">✨</span>
                <span className="absolute -left-3 bottom-0 text-sm animate-pulse delay-300">💪</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {t("emptyPageTitle")}
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {t("emptyPageSubtitle")}
              </p>
            </div>
          )}
          <AchievementAccordion rows={rows} onSelect={setSelected} />
        </>
      )}

      <BadgeDetailDrawer badge={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
