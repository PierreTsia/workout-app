import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useCreateProgram } from "@/hooks/useCreateProgram"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CreateProgramDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProgramDialog({
  open,
  onOpenChange,
}: CreateProgramDialogProps) {
  const { t } = useTranslation("library")
  const navigate = useNavigate()
  const createProgram = useCreateProgram()

  const [name, setName] = useState("")

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setName("")
    onOpenChange(nextOpen)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim() || t("programNamePlaceholder")

    createProgram.mutate(
      { name: trimmed },
      {
        onSuccess: (programId) => {
          handleOpenChange(false)
          navigate(`/builder/${programId}`, {
            state: { from: "/library/programs" },
          })
        },
        onError: () => {
          toast.error(t("errorGeneric"))
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("createProgram")}</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="program-name">{t("programName")}</Label>
            <Input
              id="program-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("programNamePlaceholder")}
              className="mt-1.5"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createProgram.isPending}
            >
              {t("common:cancel")}
            </Button>
            <Button type="submit" disabled={createProgram.isPending}>
              {createProgram.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("createProgram")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
