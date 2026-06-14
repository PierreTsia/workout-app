import { useCallback, useEffect, useRef, useState } from "react"

const TICK_MS = 250

/**
 * A self-contained countdown for in-exercise holds (block duration cells, #351).
 * `start(seconds)` arms it; it ticks down and fires `onComplete` once at zero.
 * `onComplete` is read through a ref so callers don't have to memoize it.
 */
export function useCountdown(onComplete: () => void) {
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  })

  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (endsAt == null) return
    setNow(Date.now())
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= endsAt) {
        setEndsAt(null)
        onCompleteRef.current()
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [endsAt])

  const start = useCallback((seconds: number) => {
    // Pin `now` in the same update so the first render shows the exact starting
    // value instead of a stale-clock frame (the subtle blink at anim start, #351).
    const t = Date.now()
    setNow(t)
    setEndsAt(t + seconds * 1000)
  }, [])
  const cancel = useCallback(() => setEndsAt(null), [])

  const remaining =
    endsAt == null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000))

  return { remaining, running: endsAt != null, start, cancel }
}
