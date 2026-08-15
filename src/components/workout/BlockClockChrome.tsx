import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Timer } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatSeconds } from "@/hooks/useRestTimer"

interface BlockClockChromeProps {
  startedAt: number
}

export function BlockClockChrome({ startedAt }: BlockClockChromeProps) {
  const { t } = useTranslation("workout")
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  const display = formatSeconds(elapsedSeconds)

  return (
    <Badge
      variant="outline"
      role="timer"
      aria-label={`${t("blockRunner.elapsed")} ${display}`}
      className="pointer-events-none gap-1.5 px-3 py-1 font-mono text-sm tabular-nums"
    >
      <Timer className="h-3.5 w-3.5" />
      {display}
    </Badge>
  )
}
