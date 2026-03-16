import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSaveAsProgram } from "@/hooks/useSaveAsProgram"

interface SaveAsProgramPromptProps {
  dayId: string
  defaultName: string
  onDone: () => void
}

export function SaveAsProgramPrompt({
  dayId,
  defaultName,
  onDone,
}: SaveAsProgramPromptProps) {
  const { t } = useTranslation("generator")
  const [name, setName] = useState(defaultName)
  const saveAsProgram = useSaveAsProgram()

  function handleSave() {
    saveAsProgram.mutate(
      { dayId, programName: name },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">{t("savePrompt")}</p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("programName")}
      />
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={saveAsProgram.isPending || name.trim().length === 0}
        >
          {t("saveAsProgram")}
        </Button>
        <Button variant="outline" className="flex-1" onClick={onDone}>
          {t("skip")}
        </Button>
      </div>
    </div>
  )
}
