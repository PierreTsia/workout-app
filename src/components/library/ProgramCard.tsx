import { useMemo, useRef } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Archive, ArchiveRestore, CheckCircle2, EllipsisVertical, Pencil } from "lucide-react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProgramScoreChips } from "@/components/program/ProgramScoreChips"
import { ProgramCardLayerProvider } from "@/components/library/programCardLayer"
import { cn } from "@/lib/utils"
import type { ProgramBodyMap } from "@/lib/programScore/bodyMapFromIntent"
import type { ProgramDayOutline, ProgramScore } from "@/lib/programScore/types"
import type { Program } from "@/types/onboarding"

interface ProgramCardProps {
  program: Program
  isActive: boolean
  isSessionActive: boolean
  onActivate: () => void
  onArchive: () => void
  onEdit: () => void
  score?: ProgramScore
  bodyMap?: ProgramBodyMap
  days?: readonly ProgramDayOutline[]
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
  bodyMap,
  days,
  intentLoading,
}: ProgramCardProps) {
  const { t } = useTranslation("library")
  const { t: tCommon } = useTranslation("common")

  const isArchived = program.archived_at !== null
  const formattedDate = new Date(program.created_at).toLocaleDateString()
  const showEdit = !isArchived
  const showActivate = !isActive && !isArchived
  const showArchive = !isActive
  const openLayerCountRef = useRef(0)
  const swallowNavRef = useRef(false)
  const layer = useMemo(
    () => ({
      onLayerOpenChange: (open: boolean) => {
        openLayerCountRef.current = Math.max(
          0,
          openLayerCountRef.current + (open ? 1 : -1),
        )
      },
    }),
    [],
  )

  return (
    <ProgramCardLayerProvider value={layer}>
      <Card
        className={cn(
          "relative flex h-full flex-col cursor-pointer",
          isActive && "border-primary/50 lg:col-span-2",
          isArchived && "opacity-60",
        )}
      >
        <Link
          to={`/programs/${program.id}`}
          aria-label={program.name}
          className="absolute inset-0 z-0 rounded-lg"
          onPointerDown={() => {
            if (openLayerCountRef.current === 0) return
            swallowNavRef.current = true
          }}
          onClick={(event) => {
            if (!swallowNavRef.current) return
            swallowNavRef.current = false
            event.preventDefault()
          }}
        />
        <CardHeader className="relative z-10 pointer-events-none pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className={cn("text-base", isActive && "lg:text-lg")}>
                  {program.name}
                </CardTitle>
                {isActive && <Badge>{t("active")}</Badge>}
                {isArchived && <Badge variant="outline">{t("archived")}</Badge>}
              </div>
              <CardDescription className="mt-1 text-xs">
                {t("createdOn", { date: formattedDate })}
              </CardDescription>
            </div>
          <DropdownMenu onOpenChange={layer.onLayerOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto relative h-8 w-8 shrink-0"
                  aria-label={tCommon("openMenu")}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {showEdit && (
                  <DropdownMenuItem onSelect={onEdit}>
                    <Pencil className="text-muted-foreground" aria-hidden />
                    {t("editProgram")}
                  </DropdownMenuItem>
                )}
                {showEdit && (showActivate || showArchive) && (
                  <DropdownMenuSeparator />
                )}
                {showActivate && (
                  <DropdownMenuItem
                    disabled={isSessionActive}
                    title={isSessionActive ? t("sessionActiveWarning") : undefined}
                    onSelect={onActivate}
                  >
                    <CheckCircle2 className="text-muted-foreground" aria-hidden />
                    {t("activate")}
                  </DropdownMenuItem>
                )}
                {showArchive && (
                  <DropdownMenuItem onSelect={onArchive}>
                    {isArchived ? (
                      <ArchiveRestore className="text-muted-foreground" aria-hidden />
                    ) : (
                      <Archive className="text-muted-foreground" aria-hidden />
                    )}
                    {isArchived ? t("unarchive") : t("archive")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <div className="relative z-10 flex min-h-0 flex-1 flex-col pointer-events-none px-6 pb-6">
          <ProgramScoreChips
            score={score}
            bodyMap={bodyMap}
            days={days}
            isLoading={intentLoading}
            featured={isActive}
          />
        </div>
      </Card>
    </ProgramCardLayerProvider>
  )
}
