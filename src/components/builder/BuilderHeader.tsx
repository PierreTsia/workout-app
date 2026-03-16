import { useCallback, useEffect, useRef, useState } from "react"
import { useAtomValue } from "jotai"
import { ArrowLeft, Zap } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { sessionAtom } from "@/store/atoms"
import { useProgram } from "@/hooks/useProgram"
import { useUpdateProgramName } from "@/hooks/useUpdateProgramName"
import { useActivateProgram } from "@/hooks/useActivateProgram"
import { ActivateConfirmDialog } from "@/components/library/ActivateConfirmDialog"
import { SaveIndicator } from "@/components/builder/SaveIndicator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SaveStatus = "idle" | "saving" | "saved" | "error"

interface BuilderHeaderProps {
  programId: string
  saveStatus: SaveStatus
  viewTitle: string
  onBack: () => void
}

export function BuilderHeader({
  programId,
  saveStatus,
  viewTitle,
  onBack,
}: BuilderHeaderProps) {
  const { t } = useTranslation(["builder", "library"])
  const session = useAtomValue(sessionAtom)

  const { data: program } = useProgram(programId)
  const updateName = useUpdateProgramName()
  const activateProgram = useActivateProgram()

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [activateOpen, setActivateOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  function startEditing() {
    if (!program) return
    setEditValue(program.name)
    setIsEditing(true)
  }

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === program?.name) {
      setIsEditing(false)
      return
    }
    updateName.mutate(
      { programId, name: trimmed },
      {
        onSuccess: () => setIsEditing(false),
        onError: () => {
          toast.error(t("builder:syncFailed"))
          setIsEditing(false)
        },
      },
    )
  }, [editValue, program?.name, programId, updateName, t])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitRename()
    if (e.key === "Escape") setIsEditing(false)
  }

  function handleActivateConfirm() {
    activateProgram.mutate(
      { programId },
      {
        onSuccess: () => {
          toast.success(t("builder:programActivated"))
          setActivateOpen(false)
        },
        onError: () => {
          toast.error(t("library:errorGeneric"))
          setActivateOpen(false)
        },
      },
    )
  }

  const showActivate = program && !program.is_active && !program.archived_at

  return (
    <>
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              className="h-8 text-lg font-bold"
            />
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="truncate text-left text-lg font-bold hover:text-primary"
              title={t("builder:renameProgram")}
            >
              {program?.name ?? viewTitle}
            </button>
          )}
        </div>

        {showActivate && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setActivateOpen(true)}
          >
            <Zap className="h-3.5 w-3.5" />
            {t("builder:activateProgram")}
          </Button>
        )}

        <SaveIndicator status={saveStatus} />
      </header>

      <ActivateConfirmDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        onConfirm={handleActivateConfirm}
        isSessionActive={session.isActive}
        isPending={activateProgram.isPending}
      />
    </>
  )
}
