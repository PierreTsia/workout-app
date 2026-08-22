import { useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ActivateConfirmDialog } from "@/components/library/ActivateConfirmDialog"
import { DayCard } from "@/components/library/DayCard"
import { ProgramFactsBlock } from "@/components/program/ProgramFactsBlock"
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
    isLoading: programLoading,
    isError: programError,
    error: programQueryError,
  } = useProgram(gatedId)
  const {
    data: score,
    isError: intentError,
  } = useProgramIntent(gatedId)
  const { data: days } = useProgramDayCards(gatedId)

  if (!valid) {
    return <ProgramNotFound />
  }

  if (programLoading && program == null && score == null) {
    if (!isOnline) {
      return <ProgramStatus message={t("offline")} />
    }
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
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

  if (intentError && score == null && isOnline) {
    return <ProgramStatus message={t("loadError")} />
  }

  const empty = score == null || isEmptyScore(score)
  const from = location.pathname
  const isArchived = program?.archived_at != null
  const isActive = program?.is_active === true

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
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-8">
      <div className="flex items-center gap-3 pt-1">
        <Link
          to="/library/programs"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("notFoundBack")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t("pageTitle")}</p>
          <h1 className="text-xl font-bold leading-tight">{program?.name}</h1>
        </div>
        {isActive && <Badge>{tLibrary("active")}</Badge>}
        {isArchived && <Badge variant="outline">{tLibrary("archived")}</Badge>}
      </div>

      {!isOnline && score == null ? (
        <p className="text-sm text-muted-foreground">{t("offline")}</p>
      ) : empty ? (
        <p className="text-sm text-muted-foreground">{t("empty.scores")}</p>
      ) : (
        <>
          <ProgramScoreSheet score={score} />
          <ProgramFactsBlock facts={score.facts} />
        </>
      )}

      <div className="grid gap-3">
        {(days ?? []).map((day) => (
          <DayCard
            key={day.id}
            label={day.label}
            exerciseCount={day.exerciseCount}
            items={day.items}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {gatedId != null && !isArchived && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/builder/${gatedId}`} state={{ from }}>
              {t("edit")}
            </Link>
          </Button>
        )}
        {program != null && !isActive && !isArchived && (
          <Button
            size="sm"
            onClick={() => setActivateOpen(true)}
            disabled={session.isActive}
            title={session.isActive ? tLibrary("sessionActiveWarning") : undefined}
          >
            {tLibrary("activate")}
          </Button>
        )}
        {program != null && !isActive && (
          <Button variant="ghost" size="sm" onClick={handleArchive}>
            {isArchived ? tLibrary("unarchive") : tLibrary("archive")}
          </Button>
        )}
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
