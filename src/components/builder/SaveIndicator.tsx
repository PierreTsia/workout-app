import { useEffect, useRef, useState } from "react"
import { Check, AlertTriangle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

type SaveStatus = "idle" | "saving" | "saved" | "error"

interface SaveIndicatorProps {
  status: SaveStatus
}

export function SaveIndicator({ status }: SaveIndicatorProps) {
  const { t } = useTranslation("builder")
  const [hidden, setHidden] = useState(false)
  const [prevStatus, setPrevStatus] = useState(status)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  if (prevStatus !== status) {
    setPrevStatus(status)
    if (status === "saved") {
      setHidden(false)
    }
  }

  useEffect(() => {
    if (status !== "saved") return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setHidden(true), 2000)
    return () => clearTimeout(timerRef.current)
  }, [status])

  const visible =
    (status === "saved" && !hidden) || status === "error"

  if (!visible) return null

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs font-medium transition-opacity",
        status === "saved" && "text-green-500",
        status === "error" && "text-destructive",
      )}
    >
      {status === "saved" && (
        <>
          <Check className="h-3.5 w-3.5" />
          {t("saved")}
        </>
      )}
      {status === "error" && (
        <>
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("syncFailed")}
        </>
      )}
    </span>
  )
}
