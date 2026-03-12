import { useEffect, useRef, useState } from "react"
import { useAtomValue } from "jotai"
import { Timer } from "lucide-react"
import { sessionAtom } from "@/store/atoms"

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const s = String(totalSeconds % 60).padStart(2, "0")
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

export function SessionTimerChip() {
  const session = useAtomValue(sessionAtom)
  const startedAt = session.startedAt
  const isActive = session.isActive
  const [display, setDisplay] = useState("")
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!startedAt || !isActive) {
      setDisplay("")
      return
    }

    const tick = () => setDisplay(formatElapsed(Date.now() - startedAt))
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [startedAt, isActive])

  if (!display) return null

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1">
      <Timer className="h-3.5 w-3.5 text-primary" />
      <span className="font-mono text-sm font-semibold tabular-nums text-primary">
        {display}
      </span>
    </div>
  )
}
