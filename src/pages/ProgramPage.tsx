import { useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCircle2,
  EllipsisVertical,
  Pencil,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ActivateConfirmDialog } from "@/components/library/ActivateConfirmDialog"
import { ProgramDayRow } from "@/components/program/ProgramDayRow"
import { ProgramFactsBlock } from "@/components/program/ProgramFactsBlock"
import { ProgramPageSkeleton } from "@/components/program/ProgramPageSkeleton"
import { ProgramScoreSheet } from "@/components/program/ProgramScoreSheet"
import { useActivateProgram } from "@/hooks/useActivateProgram"
import { useArchiveProgram } from "@/hooks/useArchiveProgram"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useProgram } from "@/hooks/useProgram"
import { useProgramDayCards } from "@/hooks/useProgramDayCards"
import { useProgramIntent } from "@/hooks/useProgramIntent"
import type { ProgramScore } from "@/lib/programScore/types"
import { sessionAtom } from "@/store/atoms"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidProgramId(id: string | undefined): boolean {
  return Boolean(id && UUID_RE.test(id))
}

function isEmptyScore(score: ProgramScore): boolean {
  return (
    score.hypertrophy.band === "empty" &&
    score.strength.band === "empty" &&
    score.endurance.band === "empty" &&
    score.balance.kind === "empty"
  )
}

function isNotFoundError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false
  if (!("code" in error)) return false
  return error.code === "PGRST116"
}

function ProgramNotFound() {
  const { t } = useTranslation("program")

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-8 pt-6 text-center">
      <p className="text-muted-foreground">{t("notFound")}</p>
      <Button asChild variant="secondary">
        <Link to="/library/programs">{t("notFoundBack")}</Link>
      </Button>
    </div>
  )
}

function ProgramStatus({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-8 pt-6 text-center">
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}

export function ProgramPage() {
  const { t } = useTranslation("program")
  const { t: tLibrary } = useTranslation("library")
  const { t: tCommon } = useTranslation("common")
  const { programId } = useParams<{ programId: string }>()
  const location = useLocation()
  const isOnline = useOnlineStatus()
  const session = useAtomValue(sessionAtom)
  const activateProgram = useActivateProgram()
  const archiveProgram = useArchiveProgram()
  const [activateOpen, setActivateOpen] = useState(false)

  const valid = isValidProgramId(programId)
  const gatedId = valid && programId ? programId : null
  const {
    data: program,
    isPending: programPending,
    isFetching: programFetching,
    isError: programError,
    error: programQueryError,
  } = useProgram(gatedId)
  const {
    data: score,
    isPending: intentPending,
    isError: intentError,
  } = useProgramIntent(gatedId)
  const {
    data: days,
    isPending: daysPending,
    isError: daysError,
  } = useProgramDayCards(gatedId)

  if (!valid) {
    return <ProgramNotFound />
  }

  if (program == null && (programPending || programFetching)) {
    if (!isOnline) {
      return <ProgramStatus message={t("offline")} />
    }
    return <ProgramPageSkeleton />
  }

  if (!isOnline && program == null && score == null) {
    return <ProgramStatus message={t("offline")} />
  }

  if (programError && isNotFoundError(programQueryError)) {
    return <ProgramNotFound />
  }

  if (programError && isOnline && program == null) {
    return <ProgramStatus message={t("loadError")} />
  }

  if (program == null && isOnline) {
    return <ProgramNotFound />
  }

  if (isOnline && (intentPending || daysPending)) {
    return <ProgramPageSkeleton />
  }

  if (isOnline && ((intentError && score == null) || (daysError && days == null))) {
    return <ProgramStatus message={t("loadError")} />
  }

  const empty = score == null || isEmptyScore(score)
  const from = location.pathname
  const isArchived = program?.archived_at != null
  const isActive = program?.is_active === true
  const showActivate = program != null && !isActive && !isArchived
  const showArchive = program != null && !isActive
  const showLifecycleMenu = showActivate || showArchive

  function handleActivateConfirm() {
    if (gatedId == null) return
    activateProgram.mutate(
      { programId: gatedId },
      {
        onSuccess: () => {
          toast.success(tLibrary("programActivated"))
          setActivateOpen(false)
        },
        onError: () => {
          toast.error(tLibrary("errorGeneric"))
        },
      },
    )
  }

  function handleArchive() {
    if (gatedId == null || program == null) return
    const archive = program.archived_at == null
    archiveProgram.mutate(
      { programId: gatedId, archive },
      {
        onSuccess: () => {
          toast.success(archive ? tLibrary("programArchived") : tLibrary("programUnarchived"))
        },
        onError: () => {
          toast.error(tLibrary("errorGeneric"))
        },
      },
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pb-8">
      <div className="relative flex items-center justify-center pt-1">
        <Link
          to="/library/programs"
          className="absolute left-0 rounded-md p-1 text-primary transition-colors hover:text-primary/80"
          aria-label={t("notFoundBack")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex min-w-0 max-w-[min(100%,28rem)] flex-col items-center px-16 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("pageTitle")}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-2">
            <h1 className="text-xl font-bold leading-tight">{program?.name}</h1>
            {isActive && <Badge>{tLibrary("active")}</Badge>}
            {isArchived && <Badge variant="outline">{tLibrary("archived")}</Badge>}
          </div>
        </div>
        <div className="absolute right-0 flex items-center">
          {gatedId != null && !isArchived && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-primary hover:text-primary/80"
            >
              <Link
                to={`/builder/${gatedId}`}
                state={{ from }}
                aria-label={t("edit")}
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {showLifecycleMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={tCommon("openMenu")}
                >
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {showActivate && (
                  <DropdownMenuItem
                    disabled={session.isActive}
                    title={
                      session.isActive
                        ? tLibrary("sessionActiveWarning")
                        : undefined
                    }
                    onSelect={() => setActivateOpen(true)}
                  >
                    <CheckCircle2
                      className="text-muted-foreground"
                      aria-hidden
                    />
                    {tLibrary("activate")}
                  </DropdownMenuItem>
                )}
                {showArchive && (
                  <DropdownMenuItem onSelect={handleArchive}>
                    {isArchived ? (
                      <ArchiveRestore
                        className="text-muted-foreground"
                        aria-hidden
                      />
                    ) : (
                      <Archive
                        className="text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    {isArchived ? tLibrary("unarchive") : tLibrary("archive")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {!isOnline && score == null ? (
        <p className="text-sm text-muted-foreground">{t("offline")}</p>
      ) : empty ? (
        <p className="text-sm text-muted-foreground">{t("empty.scores")}</p>
      ) : (
        <>
          <ProgramFactsBlock facts={score.facts} />
          <ProgramScoreSheet score={score} />
        </>
      )}

      <div className="grid gap-3">
        {(days ?? []).map((day, index) => (
          <ProgramDayRow
            key={day.id}
            day={day}
            index={index + 1}
            to={
              gatedId != null && !isArchived
                ? `/builder/${gatedId}`
                : undefined
            }
            linkState={
              gatedId != null && !isArchived
                ? { from, dayId: day.id }
                : undefined
            }
          />
        ))}
      </div>

      <ActivateConfirmDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        onConfirm={handleActivateConfirm}
        isSessionActive={session.isActive}
        isPending={activateProgram.isPending}
      />
    </div>
  )
}
