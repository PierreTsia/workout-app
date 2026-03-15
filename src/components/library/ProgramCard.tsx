import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Program } from "@/types/onboarding"

interface ProgramCardProps {
  program: Program
  isActive: boolean
  isSessionActive: boolean
  onActivate: () => void
  onArchive: () => void
  onDetails: () => void
}

export function ProgramCard({
  program,
  isActive,
  isSessionActive,
  onActivate,
  onArchive,
  onDetails,
}: ProgramCardProps) {
  const { t } = useTranslation("library")

  const isArchived = program.archived_at !== null
  const formattedDate = new Date(program.created_at).toLocaleDateString()

  return (
    <Card className={cn(isActive && "border-primary/50", isArchived && "opacity-60")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{program.name}</CardTitle>
            {isActive && <Badge>{t("active")}</Badge>}
            {isArchived && <Badge variant="outline">{t("archived")}</Badge>}
          </div>
          <button
            type="button"
            onClick={onDetails}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {t("details")}
          </button>
        </div>
        <Badge variant="outline" className="w-fit text-[10px]">
          {t("generatedOn", { date: formattedDate })}
        </Badge>
      </CardHeader>
      {!isActive && (
        <CardContent className="flex gap-2 pt-0">
          {!isArchived && (
            <Button
              size="sm"
              onClick={onActivate}
              disabled={isSessionActive}
              title={isSessionActive ? t("sessionActiveWarning") : undefined}
            >
              {t("activate")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onArchive}>
            {isArchived ? t("unarchive") : t("archive")}
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
