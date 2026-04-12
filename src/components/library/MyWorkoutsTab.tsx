import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Dumbbell, Loader2, Plus } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { sessionAtom } from "@/store/atoms"
import { useUserPrograms } from "@/hooks/useUserPrograms"
import { useActivateProgram } from "@/hooks/useActivateProgram"
import { useArchiveProgram } from "@/hooks/useArchiveProgram"
import { ProgramCard } from "@/components/library/ProgramCard"
import { ProgramDetailSheet } from "@/components/library/ProgramDetailSheet"
import { ActivateConfirmDialog } from "@/components/library/ActivateConfirmDialog"
import type { Program } from "@/types/onboarding"

export function MyWorkoutsTab() {
  const { t } = useTranslation("library")
  const navigate = useNavigate()
  const { data: programs, isLoading } = useUserPrograms()
  const session = useAtomValue(sessionAtom)
  const activateProgram = useActivateProgram()
  const archiveProgram = useArchiveProgram()

  const [showArchived, setShowArchived] = useState(false)
  const [activateTargetId, setActivateTargetId] = useState<string | null>(null)
  const [detailProgram, setDetailProgram] = useState<Program | null>(null)

  const visiblePrograms = (programs ?? []).filter((p) => {
    if (showArchived) return true
    return p.archived_at === null
  })

  function handleEdit(programId: string) {
    navigate(`/builder/${programId}`, { state: { from: "/library/programs" } })
  }

  function handleActivateConfirm() {
    if (!activateTargetId) return
    activateProgram.mutate(
      { programId: activateTargetId },
      {
        onSuccess: () => {
          toast.success(t("programActivated"))
          setActivateTargetId(null)
        },
        onError: () => {
          toast.error(t("errorGeneric"))
        },
      },
    )
  }

  function handleArchive(programId: string, archive: boolean) {
    archiveProgram.mutate(
      { programId, archive },
      {
        onSuccess: () => {
          toast.success(archive ? t("programArchived") : t("programUnarchived"))
        },
        onError: () => {
          toast.error(t("errorGeneric"))
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          {t("myPrograms")}
        </h2>
      </div>

      <Button
        className="w-full gap-2"
        variant="outline"
        onClick={() => navigate("/create-program")}
        disabled={session.isActive}
        title={session.isActive ? t("sessionActiveWarning") : undefined}
      >
        <Plus className="h-4 w-4" />
        {t("createProgram")}
      </Button>

      {session.isActive && (
        <p className="text-center text-xs text-muted-foreground">
          {t("sessionActiveWarning")}
        </p>
      )}

      {visiblePrograms.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("myWorkoutsEmpty")}</p>
      )}

      {visiblePrograms.map((program) => (
        <ProgramCard
          key={program.id}
          program={program}
          isActive={program.is_active}
          isSessionActive={session.isActive}
          onActivate={() => setActivateTargetId(program.id)}
          onArchive={() => handleArchive(program.id, program.archived_at === null)}
          onDetails={() => setDetailProgram(program)}
          onEdit={() => handleEdit(program.id)}
        />
      ))}

      <div className="flex items-center gap-2 pt-2">
        <Switch
          id="show-archived"
          checked={showArchived}
          onCheckedChange={setShowArchived}
        />
        <label htmlFor="show-archived" className="text-sm text-muted-foreground">
          {t("showArchived")}
        </label>
      </div>

      <ProgramDetailSheet
        program={detailProgram}
        open={detailProgram !== null}
        onOpenChange={(open) => { if (!open) setDetailProgram(null) }}
        onEdit={handleEdit}
      />

      <ActivateConfirmDialog
        open={activateTargetId !== null}
        onOpenChange={(open) => { if (!open) setActivateTargetId(null) }}
        onConfirm={handleActivateConfirm}
        isSessionActive={session.isActive}
        isPending={activateProgram.isPending}
      />

    </div>
  )
}
