import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Timer } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatSeconds } from "@/hooks/useRestTimer"

interface BlockClockChromeProps {
  startedAt: number
  /** When set, chrome is a countdown (AMRAP cap). Pause does not freeze it. */
  capSeconds?: number
  onExpire?: () => void
}

export function BlockClockChrome({
  startedAt,
  capSeconds,
  onExpire,
}: BlockClockChromeProps) {
  const { t } = useTranslation("workout")
  const [now, setNow] = useState(() => Date.now())
  const expiredRef = useRef(false)

  useEffect(() => {
    expiredRef.current = false
    const id = window.setInterval(() => {
      const tNow = Date.now()
      setNow(tNow)
      if (
        capSeconds != null &&
        onExpire &&
        !expiredRef.current &&
        tNow - startedAt >= capSeconds * 1000
      ) {
        expiredRef.current = true
        onExpire()
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [startedAt, capSeconds, onExpire])

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  const remainingSeconds =
    capSeconds == null
      ? null
      : Math.max(0, capSeconds - elapsedSeconds)
  const display = formatSeconds(remainingSeconds ?? elapsedSeconds)
  const labelKey =
    remainingSeconds == null ? "blockRunner.elapsed" : "blockRunner.remaining"

  return (
    <Badge
      variant="outline"
      role="timer"
      aria-label={`${t(labelKey)} ${display}`}
      className="pointer-events-none gap-1.5 px-3 py-1 font-mono text-sm tabular-nums"
    >
      <Timer className="h-3.5 w-3.5" />
      {display}
    </Badge>
  )
}
