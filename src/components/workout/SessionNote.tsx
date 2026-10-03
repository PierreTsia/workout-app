import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@nomosui/react"

interface SessionNoteProps {
  /** Existing note, if the session already carries one. */
  initialNote?: string
  /** Persists the note — fired on blur only when the value actually changed. */
  onSave: (note: string) => void
}

/** S3 one-line session note (T267). Optional, never blocking. */
export function SessionNote({ initialNote = "", onSave }: SessionNoteProps) {
  const { t } = useTranslation("workout")
  const [value, setValue] = useState(initialNote)

  return (
    <div className="w-full max-w-xs">
      <h3 className="mb-3 text-center text-sm font-semibold">
        {t("deviation.sessionNoteTitle")}
      </h3>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim() !== initialNote.trim()) onSave(value)
        }}
        placeholder={t("deviation.sessionNotePlaceholder")}
      />
    </div>
  )
}
