import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProgramScoreChips } from "@/components/program/ProgramScoreChips"
import { cn } from "@/lib/utils"
import type { ProgramScore } from "@/lib/programScore/types"
import type { Program } from "@/types/onboarding"

interface ProgramCardProps {
  program: Program
  isActive: boolean
  isSessionActive: boolean
  onActivate: () => void
  onArchive: () => void
  onEdit: () => void
  score?: ProgramScore
  intentLoading?: boolean
}

export function ProgramCard({
  program,
  isActive,
  isSessionActive,
  onActivate,
  onArchive,
  onEdit,
  score,
  intentLoading,
}: ProgramCardProps) {
  const { t } = useTranslation("library")

  const isArchived = program.archived_at !== null
  const formattedDate = new Date(program.created_at).toLocaleDateString()

  return (
    <Card className={cn(isActive && "border-primary/50", isArchived && "opacity-60")}>
      <Link to={`/programs/${program.id}`} className="block">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{program.name}</CardTitle>
              {isActive && <Badge>{t("active")}</Badge>}
              {isArchived && <Badge variant="outline">{t("archived")}</Badge>}
            </div>
          </div>
          <ProgramScoreChips score={score} isLoading={intentLoading} />
          <Badge variant="outline" className="w-fit text-[10px]">
            {t("generatedOn", { date: formattedDate })}
          </Badge>
        </CardHeader>
      </Link>
      <CardContent
        className="flex gap-2 pt-0"
        onClick={(event) => event.stopPropagation()}
      >
        {!isArchived && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            {t("editProgram")}
          </Button>
        )}
        {!isActive && !isArchived && (
          <Button
            size="sm"
            onClick={onActivate}
            disabled={isSessionActive}
            title={isSessionActive ? t("sessionActiveWarning") : undefined}
          >
            {t("activate")}
          </Button>
        )}
        {!isActive && (
          <Button variant="ghost" size="sm" onClick={onArchive}>
            {isArchived ? t("unarchive") : t("archive")}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
