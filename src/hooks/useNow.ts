import { useCallback, useRef, useState, useSyncExternalStore } from "react"

/**
 * A ticking wall-clock, subscribed only while `active`. Reads the time through
 * a cached ref so `getSnapshot` stays stable between renders (the external-store
 * contract), and updates on each interval — the idiomatic replacement for a
 * `setState(Date.now())` inside an effect.
 */
export function useNow(active: boolean, intervalMs = 250): number {
  const [initial] = useState(() => Date.now())
  const nowRef = useRef(initial)
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!active) return () => {}
      nowRef.current = Date.now()
      const id = setInterval(() => {
        nowRef.current = Date.now()
        onStoreChange()
      }, intervalMs)
      return () => clearInterval(id)
    },
    [active, intervalMs],
  )
  const getSnapshot = useCallback(() => nowRef.current, [])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
