import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateProgram } from "@/hooks/useCreateProgram"

export function BlankProgramStep() {
  const { t } = useTranslation("create-program")
  const navigate = useNavigate()
  const createProgram = useCreateProgram()
  const [name, setName] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim() || t("programNamePlaceholder")

    createProgram.mutate(
      { name: trimmed },
      {
        onSuccess: (programId) => {
          navigate(`/builder/${programId}`, { state: { from: "/create-program" } })
        },
        onError: () => toast.error(t("errorGeneric")),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-6 pt-4">
      <h2 className="text-lg font-semibold">{t("pathBlank")}</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="program-name">{t("programName")}</Label>
        <Input
          id="program-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("programNamePlaceholder")}
          autoFocus
        />
      </div>

      <Button type="submit" disabled={createProgram.isPending} className="mt-2">
        {createProgram.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          t("create")
        )}
      </Button>
    </form>
  )
}
