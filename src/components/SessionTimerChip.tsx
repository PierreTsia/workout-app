import { useEffect, useRef, useState } from "react"
import { useAtomValue } from "jotai"
import { sessionAtom } from "@/store/atoms"

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const s = String(totalSeconds % 60).padStart(2, "0")
  return `${h}:${m}:${s}`
}

const ZERO = "00:00:00"

export function SessionTimerChip() {
  const session = useAtomValue(sessionAtom)
  const startedAt = session.startedAt
  const [display, setDisplay] = useState(ZERO)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!startedAt) {
      setDisplay(ZERO)
      return
    }

    const tick = () => setDisplay(formatElapsed(Date.now() - startedAt))
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [startedAt])

  return (
    <span className="font-mono text-lg font-bold tabular-nums tracking-wide">
      {display}
    </span>
  )
}
